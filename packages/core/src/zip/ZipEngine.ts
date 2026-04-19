/**
 * ZipEngine — orchestrates streaming ZIP creation from URLs or OPFS files.
 *
 * This is the implementation behind `ds.zip('my-photos.zip')`.
 * Files are downloaded and zipped concurrently without loading all data into RAM.
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
 *
 * - Chrome/Edge: Uses File System Access API `showSaveFilePicker`
 * - Firefox/Safari/others: Falls back to streamsaver.js
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
        // Fall through to streamsaver
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
   * to the user's disk. Zero RAM spikes — files are compressed as they arrive.
   *
   * @example
   * await zipEngine.streamArchive('photos.zip', [
   *   { url: 'https://cdn.example.com/img1.jpg', fileName: 'img1.jpg' },
   * ])
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
      const rootDir = supportsOPFS() ? await navigator.storage.getDirectory() : null;

      for (const req of requests) {
        let stream: ReadableStream<Uint8Array> | null = null;

        // Prefer OPFS if the file was already staged
        if (req.opfsId && rootDir) {
          try {
            const fileHandle = await rootDir.getFileHandle(req.opfsId);
            const file = await fileHandle.getFile();
            stream = file.stream();
          } catch {
            // OPFS entry not found — fall through to network fetch
          }
        }

        // Network fetch as fallback (or primary for on-the-fly zip)
        if (!stream) {
          const response = await fetch(req.url);
          if (!response.ok || !response.body) {
            console.warn(
              `[ZipIt] Failed to fetch ${req.url} (HTTP ${response.status}). Skipping.`
            );
            continue;
          }
          stream = response.body;
        }

        await compressor.addFileStream(req.fileName, stream);
      }

      compressor.end();
      await downloadPromise;
    } finally {
      this._isBusy = false;
    }
  }
}

function supportsOPFS(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}
