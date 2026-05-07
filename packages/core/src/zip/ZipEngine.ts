/**
 * ZipEngine — orchestrates streaming ZIP creation from URLs or OPFS files.
 *
 * This is the implementation behind `ds.zip('my-photos.zip')`.
 *
 * @internal
 */

import OpfsStore from '../storage/OpfsStore';
import { ZipPipeline } from '../ZipPipeline';

export interface ZipRequest {
  url: string;
  fileName: string;
  /** If provided, reads from OPFS instead of re-fetching from network. */
  opfsId?: string;
}

export interface ZipEngineOptions {
  compressionLevel?: 0 | 1 | 6 | 9;
}

export class ZipEngine {
  private options: Required<ZipEngineOptions>;
  private _isBusy = false;

  constructor(options: ZipEngineOptions = {}) {
    this.options = {
      compressionLevel: options.compressionLevel ?? 6,
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

    try {
      const opfsStore = await OpfsStore.open('zipit-v1');
      const pipeline = new ZipPipeline({ compressionLevel: this.options.compressionLevel }, opfsStore);
      await pipeline.prepare(archiveName);
      for (const req of requests) {
        if (req.opfsId) {
          await pipeline.addFile({
            id: req.opfsId,
            path: req.fileName,
            url: req.url,
            sizeBytes: undefined,
          });
        } else {
          console.warn(`[ZipIt] File ${req.fileName} has no opfsId. Zipping from network is not supported in this model.`);
        }
      }

      await pipeline.finalize();
    } finally {
      this._isBusy = false;
    }
  }
}
