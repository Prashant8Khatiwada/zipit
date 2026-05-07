/**
 * ZipEngine — orchestrates streaming ZIP creation from URLs or OPFS files.
 *
 * This is the implementation behind `ds.zip('my-photos.zip')`.
 *
 * @internal
 */

import { StreamCompressor } from './StreamCompressor';

export interface ZipRequest {
  url: string;
  fileName: string;
  /** If provided, reads from OPFS instead of re-fetching from network. */
  opfsId?: string;
}

export interface ZipEngineOptions {
  maxInFlight?: number;
  streamBufferBytes?: number;
}

/**
 * Cross-browser download trigger for a ReadableStream.
 */
async function triggerStreamDownload(
  fileName: string,
  stream: ReadableStream<Uint8Array>
): Promise<void> {
  // Prefer native File System Access API save dialog
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as Window & { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> })
        .showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
        });
      const writable = await handle.createWritable();
      await stream.pipeTo(writable);
      return;
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name !== 'AbortError') {
        console.warn('[ZipIt] showSaveFilePicker failed, falling back to streamsaver:', e.message);
      } else {
        throw e; // User cancelled
      }
    }
  }

  // Fallback: streamsaver.js (Service Worker based)
  const streamSaver = await import('streamsaver');
  const fileStream = streamSaver.default.createWriteStream(fileName);
  await stream.pipeTo(fileStream);
}

export class ZipEngine {
  private options: Required<ZipEngineOptions>;
  private _isBusy = false;

  constructor(options: ZipEngineOptions = {}) {
    this.options = {
      maxInFlight: options.maxInFlight ?? 10,
      streamBufferBytes: options.streamBufferBytes ?? 5 * 1024 * 1024,
    };
  }

  get isBusy(): boolean {
    return this._isBusy;
  }

  /**
   * Stream-zip the provided requests into a single archive delivered directly
   * to the user's disk.
   */
  async streamArchive(
    archiveName: string,
    requests: ZipRequest[]
  ): Promise<void> {
    if (this._isBusy) {
      throw new Error(
        '[ZipIt] ZipEngine is already streaming an archive. ' +
          'Wait for the current operation to complete before starting a new one.'
      );
    }

    this._isBusy = true;

    const compressor = new StreamCompressor({
      maxInFlight: this.options.maxInFlight,
      streamBufferBytes: this.options.streamBufferBytes,
    });
    const zipStream = compressor.getStream();

    // Trigger the OS download FIRST so the browser shows progress immediately
    const downloadPromise = triggerStreamDownload(archiveName, zipStream).catch(
      (err: unknown) => {
        console.error('[ZipIt] Stream download failed:', err);
      }
    );

    try {
      for (const req of requests) {
        if (req.opfsId) {
          await compressor.addFile(req.opfsId, req.fileName);
        } else {
          console.warn(`[ZipIt] File ${req.fileName} has no opfsId. Zipping from network is not supported in this model.`);
        }
      }

      compressor.finalize();
      await downloadPromise;
    } finally {
      this._isBusy = false;
    }
  }
}
