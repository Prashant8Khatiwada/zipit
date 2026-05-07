/// <reference lib="webworker" />

import type { DownloadWorkerInbound, DownloadWorkerOutbound } from '../types';
import OpfsStore from '../storage/OpfsStore';

const activeDownloads = new Map<string, AbortController>();

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<DownloadWorkerInbound>) => {
  const message = event.data;

  if (message.type === 'StartChunk') {
    void handleStartChunk(message);
    return;
  }

  const controller = activeDownloads.get(message.fileId);
  controller?.abort();
  post({
    type: 'ChunkError',
    fileId: message.fileId,
    error: 'aborted',
    retryable: false,
  });
};

async function handleStartChunk(
  message: Extract<DownloadWorkerInbound, { type: 'StartChunk' }>
): Promise<void> {
  if (activeDownloads.has(message.fileId)) {
    return;
  }

  const controller = new AbortController();
  activeDownloads.set(message.fileId, controller);

  try {
    await downloadChunk(message, controller.signal);
  } catch (error) {
    post({
      type: 'ChunkError',
      fileId: message.fileId,
      error: error instanceof Error ? error.message : String(error),
      retryable: isRetryableError(error),
    });
  } finally {
    activeDownloads.delete(message.fileId);
  }
}

async function downloadChunk(
  message: Extract<DownloadWorkerInbound, { type: 'StartChunk' }>,
  signal: AbortSignal
): Promise<void> {
  const headers = new Headers();
  headers.set('Range', `bytes=${message.startByte}-${message.endByte ?? ''}`);

  const response = await fetch(message.url, { headers, signal });
  if (!response.ok || (message.startByte > 0 && response.status !== 206 && response.status !== 200)) {
    throw new HttpDownloadError(response.status);
  }
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const opfs = await OpfsStore.open(message.sessionId);
  const reader = response.body.getReader();
  const totalChunkBytes = getTotalChunkBytes(message, response);
  const rangeUnsupported = message.startByte > 0 && response.status === 200;
  let skippedBytes = 0;
  let writeOffset = message.startByte;
  let bytesReceived = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }

    const data = rangeUnsupported
      ? skipAlreadyDownloadedBytes(value, message.startByte, skippedBytes)
      : value;
    skippedBytes += value.byteLength;
    if (data.byteLength === 0) {
      continue;
    }

    await opfs.writeChunk(message.fileId, writeOffset, data);
    writeOffset += data.byteLength;
    bytesReceived += data.byteLength;

    post({
      type: 'ChunkProgress',
      fileId: message.fileId,
      bytesReceived,
      totalChunkBytes,
    });
  }

  post({
    type: 'ChunkDone',
    fileId: message.fileId,
    startByte: message.startByte,
    endByte: message.endByte,
  });
}

function skipAlreadyDownloadedBytes(
  chunk: Uint8Array,
  targetStartByte: number,
  skippedBytes: number
): Uint8Array {
  const remainingToSkip = Math.max(0, targetStartByte - skippedBytes);
  if (remainingToSkip >= chunk.byteLength) {
    return new Uint8Array(0);
  }
  return chunk.slice(remainingToSkip);
}

function getTotalChunkBytes(
  message: Extract<DownloadWorkerInbound, { type: 'StartChunk' }>,
  response: Response
): number | undefined {
  if (message.endByte !== undefined) {
    return message.endByte - message.startByte + 1;
  }

  const contentLength = response.headers.get('Content-Length');
  if (!contentLength) {
    return undefined;
  }

  const parsed = Number(contentLength);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function post(message: DownloadWorkerOutbound): void {
  workerScope.postMessage(message);
}

class HttpDownloadError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpDownloadError';
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }
  if (error instanceof HttpDownloadError) {
    return error.status === 429 || error.status >= 500;
  }
  return true;
}
