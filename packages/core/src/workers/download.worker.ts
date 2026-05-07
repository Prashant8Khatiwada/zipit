/// <reference lib="webworker" />
/**
 * ZipIt Download Worker
 */

import type { DownloadWorkerInbound, DownloadWorkerOutbound } from '../types';

// ─── Worker state ──────────────────────────────────────────────────────────────
const activeTasks = new Map<string, { abortController: AbortController }>();

self.onmessage = async (event: MessageEvent<DownloadWorkerInbound>) => {
  const msg = event.data;

  if (msg.type === 'START_CHUNK') {
    const { id, url, startByte } = msg;
    if (activeTasks.has(id)) return;

    const abortController = new AbortController();
    activeTasks.set(id, { abortController });

    try {
      await processDownload(id, url, startByte, abortController.signal);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === 'AbortError' || abortController.signal.aborted) {
        // Silently handle abort
      } else {
        self.postMessage({
          type: 'CHUNK_ERROR',
          id,
          message: e.message || String(e),
        } satisfies DownloadWorkerOutbound);
      }
    } finally {
      activeTasks.delete(id);
    }
  } else if (msg.type === 'ABORT_DOWNLOAD') {
    activeTasks.get(msg.id)?.abortController.abort();
  }
};

async function processDownload(
  id: string,
  url: string,
  startByte: number,
  signal: AbortSignal
): Promise<void> {
  const rootDir = await navigator.storage.getDirectory();
  const fileHandle = await rootDir.getFileHandle(id, { create: true });
  // @ts-ignore — createSyncAccessHandle is available in workers
  const accessHandle = await fileHandle.createSyncAccessHandle();

  try {
    const headers = new Headers();
    if (startByte > 0) headers.set('Range', `bytes=${startByte}-`);

    let response = await fetchWithFallback(url, headers, signal);

    if (!response.body) throw new Error('Response body is null');

    const reader = response.body.getReader();
    let currentByte = startByte;
    let lastReportTime = Date.now();
    const REPORT_INTERVAL_MS = 300;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // @ts-ignore — write options available in workers
      accessHandle.write(value, { at: currentByte });
      currentByte += value.byteLength;

      const now = Date.now();
      if (now - lastReportTime > REPORT_INTERVAL_MS) {
        self.postMessage({
          type: 'CHUNK_PROGRESS',
          id,
          loaded: currentByte,
        } satisfies DownloadWorkerOutbound);
        lastReportTime = now;
      }
    }

    // @ts-ignore
    if (typeof accessHandle.flush === 'function') accessHandle.flush();

    // Final progress report
    self.postMessage({
      type: 'CHUNK_PROGRESS',
      id,
      loaded: currentByte,
    } satisfies DownloadWorkerOutbound);

    self.postMessage({ type: 'CHUNK_DONE', id, size: currentByte } satisfies DownloadWorkerOutbound);
  } finally {
    accessHandle.close();
  }
}

/** Smart failover: HEAD check on 4xx/5xx before giving up. */
async function fetchWithFallback(
  url: string,
  headers: Headers,
  signal: AbortSignal
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(url, { headers, signal });

    if (!response.ok && response.status !== 206) {
      const head = await fetch(url, { method: 'HEAD', signal });
      if (head.status === 200) {
        response = await fetch(url, { headers, signal });
        if (!response.ok)
          throw new Error(`Download failed with HTTP ${response.status}`);
      } else {
        throw new Error(`Resource inaccessible (HTTP ${head.status})`);
      }
    }
  } catch (e: unknown) {
    const err = e as Error;
    if (err.name === 'AbortError') throw err;
    // Network error — attempt HEAD as diagnostic
    const head = await fetch(url, { method: 'HEAD', signal }).catch(() => null);
    if (head?.status === 200) {
      response = await fetch(url, { headers, signal });
    } else {
      throw err;
    }
  }

  return response;
}
