/// <reference lib="webworker" />
/**
 * ZipIt ZIP Worker
 */

import { Zip, ZipPassThrough } from 'fflate';
import type { ZipWorkerInbound, ZipWorkerOutbound } from '../types';

let zip: Zip;
let zipChunks: BlobPart[] = [];

zip = new Zip((err, chunk) => {
  if (err) {
    self.postMessage({ type: 'ZIP_ERROR', message: err.message } satisfies ZipWorkerOutbound);
    return;
  }
  const copy = new Uint8Array(chunk.byteLength);
  copy.set(chunk);
  zipChunks.push(copy.buffer);
});

self.onmessage = async (event: MessageEvent<ZipWorkerInbound>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'ADD_FILE': {
      try {
        const fileStream = new ZipPassThrough(msg.path);
        zip.add(fileStream);

        const rootDir = await navigator.storage.getDirectory();
        const fileHandle = await rootDir.getFileHandle(msg.id);
        const file = await fileHandle.getFile();
        const reader = file.stream().getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            fileStream.push(new Uint8Array(0), true);
            break;
          }
          // Type assertion: FileHandle.getFile() returns a regular File with ArrayBuffer, not SharedArrayBuffer
          // Cast to any first, then to the expected type to bypass strict type checking
          fileStream.push(value as any, false);
        }
      } catch (err: unknown) {
        self.postMessage({ 
          type: 'ZIP_ERROR', 
          message: (err as Error).message 
        } satisfies ZipWorkerOutbound);
      }
      break;
    }

    case 'FINALIZE': {
      zip.end();
      const blob = new Blob(zipChunks, { type: 'application/zip' });
      self.postMessage({ type: 'ZIP_DONE', blob } satisfies ZipWorkerOutbound);
      // Reset for next potential use or just let it be terminated
      zipChunks = [];
      break;
    }
  }
};
