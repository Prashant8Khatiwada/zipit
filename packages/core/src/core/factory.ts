/**
 * createZipIt — the primary public factory function.
 */

import type {
  ZipitConfig,
  ZipItInstance,
  AddFileOptions,
  FileDescriptor,
} from '../types';
import { StateStore } from '../store/StateStore';
import { DownloadEngine } from './DownloadEngine';
import { ZipEngine } from '../zip/ZipEngine';
import { filenameFromUrl, idFromUrl } from '../utils/helpers';

const DEFAULT_CONFIG: ZipitConfig = {
  concurrency: 3,
  chunkSizeBytes: 4 * 1024 * 1024,
  compressionLevel: 6,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

/**
 * Create a new ZipIt instance.
 *
 * @param config - Configuration for concurrency, buffering, and event handlers.
 * @returns A `ZipItInstance` with the full public API.
 */
export function createZipIt(config: Partial<ZipitConfig> = {}): ZipItInstance {
  const resolved: ZipitConfig = { ...DEFAULT_CONFIG, ...config };

  const store = new StateStore('zipit_v1');
  const engine = new DownloadEngine(resolved, store);
  const zipEngine = new ZipEngine({
    compressionLevel: resolved.compressionLevel,
  });

  // ─── Helper ───────────────────────────────────────────────────────────────

  function buildDescriptor(url: string, opts: AddFileOptions = {}): FileDescriptor {
    const filename = opts.filename ?? filenameFromUrl(url);
    const folder = opts.folder ?? '';
    const path = folder ? `${folder}/${filename}` : filename;
    const id = idFromUrl(`${url}${path}`);
    
    return {
      id,
      url,
      path,
      sizeBytes: opts.sizeBytes,
      metadata: opts.metadata,
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  const instance: ZipItInstance = {
    add(url, opts) {
      const descriptor = buildDescriptor(url, opts);
      engine.addFile(descriptor);
      return descriptor;
    },

    addAll(urls, opts) {
      return urls.map((url) => instance.add(url, opts));
    },

    async start(opts) {
      await engine.start(opts);
    },

    pause() {
      engine.pause();
    },

    resume() {
      engine.resume();
    },

    cancel() {
      engine.cancel();
    },

    async zip(outputFilename = 'zipit-archive.zip') {
      const files = engine.getFiles();
      // Actually DownloadEngine.getFiles() now returns FileDescriptor[]
      // We might need to know which ones are staged. 
      // For now, let's just pass them to zipEngine.
      const requests = files.map((f) => ({
        url: f.url,
        fileName: f.path,
        // We don't easily have 'staged' info here anymore without more plumbing
        // but ZipEngine can check OPFS itself if we give it the id.
        opfsId: f.id, 
      }));
      await zipEngine.streamArchive(outputFilename, requests);
    },

    async saveToFolder() {
      if (!('showDirectoryPicker' in window)) {
        throw new Error(
          '[ZipIt] File System Access API (showDirectoryPicker) is not supported in this browser. ' +
            'Use ds.zip() as a fallback for Firefox/Safari.'
        );
      }
      const handle = await (
        window as Window & { showDirectoryPicker: (opts: unknown) => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker({ mode: 'readwrite' });
      engine.setDirectoryHandle(handle);
    },

    on(event: string, handler: any) {
      return engine.on(event as any, handler);
    },

    off(event: string, handler: any) {
      engine.off(event as any, handler);
    },

    getFiles() {
      return engine.getFiles();
    },

    getProgress() {
      return engine.getProgress();
    },

    isPaused() {
      return engine.isPaused();
    },

    isBusy() {
      return engine.isBusy();
    },

    async reset() {
      await engine.reset();
    },

    async hydrate() {
      return engine.hydrate();
    },
  };

  return instance;
}
