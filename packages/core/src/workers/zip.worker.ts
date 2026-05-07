/// <reference lib="webworker" />

import type { ZipWorkerInbound, ZipWorkerOutbound } from '../types';

type FflateModule = typeof import('fflate');
type ZipInstance = InstanceType<FflateModule['Zip']>;
type ZipDeflateInstance = InstanceType<FflateModule['ZipDeflate']>;

interface WriterPortMessage {
  type: 'ZipData' | 'WriterDrain';
  chunk?: Uint8Array;
}

interface OpfsPortMessage {
  type: 'OpfsChunk' | 'OpfsEnd' | 'OpfsAck';
  chunk?: Uint8Array;
}

const scope = self as DedicatedWorkerGlobalScope;

let writerPort: MessagePort | null = null;
let zip: ZipInstance | null = null;
let ZipDeflateCtor: FflateModule['ZipDeflate'] | null = null;
let compressionLevel: 0 | 1 | 6 | 9 = 6;
let compressedBytes = 0;
let totalBytes = 0;
let finalizeRequested = false;
let doneSent = false;

const outputQueue: Uint8Array[] = [];
let outputInFlight = false;
let writerAckResolver: (() => void) | null = null;

scope.onmessage = (event: MessageEvent<ZipWorkerInbound>) => {
  const message = event.data;

  switch (message.type) {
    case 'Init':
      void initialize(message.writerPort, message.compressionLevel);
      break;
    case 'AddFile':
      void addFile(message.fileId, message.path, message.size, message.opfsPort);
      break;
    case 'Finalize':
    case 'FINALIZE':
      finalizeRequested = true;
      zip?.end();
      void maybeFinish();
      break;
    case 'ADD_FILE':
      if (!zip || !ZipDeflateCtor) {
        postError('worker not initialized');
        return;
      }
      void addLegacyFile(message.id, message.path, message.size ?? 0);
      break;
  }
};

async function initialize(port: MessagePort, level: 0 | 1 | 6 | 9): Promise<void> {
  const { Zip, ZipDeflate } = (await import('fflate')) as FflateModule;
  ZipDeflateCtor = ZipDeflate;
  compressionLevel = level;
  compressedBytes = 0;
  totalBytes = 0;
  finalizeRequested = false;
  doneSent = false;
  outputQueue.length = 0;
  outputInFlight = false;
  writerAckResolver = null;
  writerPort = port;
  writerPort.onmessage = (event: MessageEvent<WriterPortMessage>) => {
    if (event.data.type === 'WriterDrain') {
      const resolve = writerAckResolver;
      writerAckResolver = null;
      resolve?.();
    }
  };
  writerPort.start();

  zip = new Zip((err, chunk) => {
    if (err) {
      postError(err.message);
      return;
    }
    if (chunk) {
      outputQueue.push(transferable(chunk));
      void pumpOutput();
    }
  });

  void compressionLevel;
}

async function addFile(
  fileId: string,
  path: string,
  size: number,
  opfsPort: MessagePort
): Promise<void> {
  if (!zip || !ZipDeflateCtor) {
    postError('worker not initialized');
    return;
  }

  totalBytes += size;
  const file = new ZipDeflateCtor(path, { level: compressionLevel }) as ZipDeflateInstance;
  zip.add(file);

  opfsPort.onmessage = (event: MessageEvent<OpfsPortMessage>) => {
    const message = event.data;
    if (message.type === 'OpfsChunk' && message.chunk) {
      file.push(message.chunk, false);
      opfsPort.postMessage({ type: 'OpfsAck' } satisfies OpfsPortMessage);
      postProgress();
      return;
    }

    if (message.type === 'OpfsEnd') {
      file.push(new Uint8Array(0), true);
      opfsPort.postMessage({ type: 'OpfsAck' } satisfies OpfsPortMessage);
      scope.postMessage({ type: 'FileZipped', fileId } satisfies ZipWorkerOutbound);
      postProgress();
      void maybeFinish();
    }
  };
  opfsPort.start();
}

async function addLegacyFile(fileId: string, path: string, size: number): Promise<void> {
  if (!zip || !ZipDeflateCtor) {
    postError('worker not initialized');
    return;
  }

  totalBytes += size;
  const file = new ZipDeflateCtor(path, { level: compressionLevel }) as ZipDeflateInstance;
  zip.add(file);
  file.push(new Uint8Array(0), true);
  scope.postMessage({ type: 'FileZipped', fileId } satisfies ZipWorkerOutbound);
  await maybeFinish();
}

async function pumpOutput(): Promise<void> {
  if (!writerPort || outputInFlight) {
    return;
  }

  const next = outputQueue.shift();
  if (!next) {
    await maybeFinish();
    return;
  }

  outputInFlight = true;
  try {
    await new Promise<void>((resolve) => {
      writerAckResolver = resolve;
      writerPort?.postMessage({ type: 'ZipData', chunk: next } satisfies WriterPortMessage, [
        next.buffer,
      ]);
    });
    compressedBytes += next.byteLength;
    postProgress();
  } finally {
    outputInFlight = false;
    void pumpOutput();
  }
}

async function maybeFinish(): Promise<void> {
  if (finalizeRequested && !doneSent && !outputInFlight && outputQueue.length === 0) {
    doneSent = true;
    scope.postMessage({ type: 'ZipDone', finalSizeBytes: compressedBytes } satisfies ZipWorkerOutbound);
  }
}

function postProgress(): void {
  scope.postMessage({
    type: 'ZipProgress',
    compressedBytes,
    totalBytes,
  } satisfies ZipWorkerOutbound);
}

function postError(error: string): void {
  scope.postMessage({ type: 'ZipError', error } satisfies ZipWorkerOutbound);
}

function transferable(chunk: Uint8Array): Uint8Array {
  return chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength
    ? chunk
    : new Uint8Array(chunk);
}
