/// <reference lib="webworker" />
/**
 * ZipIt ZIP Worker
 */

import { Zip, ZipPassThrough } from 'fflate';
import type { ZipWorkerInbound, ZipWorkerOutbound } from '../types';

let zip: Zip;
let zipChunks: Uint8Array[] = [];

zip = new Zip((err, chunk, final) => {
  if (err) {
    self.postMessage({ type: 'ZIP_ERROR', message: err.message } satisfies ZipWorkerOutbound);
    return;
  }
  zipChunks.push(chunk);
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
          fileStream.push(value, false);
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
