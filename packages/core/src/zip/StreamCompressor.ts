/**
 * StreamCompressor — bridges the ZIP Web Worker into a WHATWG ReadableStream.
 *
 * @internal
 */

import type { ZipWorkerInbound, ZipWorkerOutbound } from '../types';

export class StreamCompressor {
  private worker: Worker;
  private readable: ReadableStream<Uint8Array>;
  private controller!: ReadableStreamDefaultController<Uint8Array>;

  constructor(options: { maxInFlight?: number; streamBufferBytes?: number } = {}) {
    this.worker = new Worker(
      new URL('../workers/zip.worker.js', import.meta.url),
      { type: 'module' }
    );

    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
    });

    this.worker.onmessage = async (e: MessageEvent<ZipWorkerOutbound>) => {
      const msg = e.data;
      if (msg.type === 'ZIP_DONE') {
        const arrayBuffer = await msg.blob.arrayBuffer();
        this.controller.enqueue(new Uint8Array(arrayBuffer));
        this.controller.close();
        this.worker.terminate();
      } else if (msg.type === 'ZIP_ERROR') {
        this.controller.error(new Error(msg.message));
        this.worker.terminate();
      }
    };
  }

  /** The ReadableStream of compressed ZIP bytes. */
  getStream(): ReadableStream<Uint8Array> {
    return this.readable;
  }

  /**
   * Add a file to the ZIP by its OPFS id and destination path.
   */
  async addFile(id: string, path: string): Promise<void> {
    this.worker.postMessage({ type: 'ADD_FILE', id, path } satisfies ZipWorkerInbound);
    // In this new model, we don't have backpressure/blocking here 
    // because the worker reads from OPFS itself. 
    // If we wanted to wait for it to be "added", we'd need another message.
    // For now, let's just send the message.
  }

  /** Signal end of all files — triggers ZIP central directory write. */
  finalize(): void {
    this.worker.postMessage({ type: 'FINALIZE' } satisfies ZipWorkerInbound);
  }
}
