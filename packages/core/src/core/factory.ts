/**
 * createZipIt — the primary public factory function.
 *
 * @example
 * ```ts
 * import { createZipIt } from '@khatiwadaprashant/zipit-core';
 *
 * const ds = createZipIt({ concurrency: 4 });
 * ds.add('https://example.com/photo1.jpg', { folder: 'photos' });
 * ds.add('https://example.com/photo2.jpg', { folder: 'photos' });
 *
 * ds.on('progress', ({ overallProgress }) => {
 *   console.log(`${(overallProgress * 100).toFixed(1)}%`);
 * });
 *
 * await ds.start({ saveToFolder: true });
 *
 * // OR: stream-zip without ever hitting the server
 * await ds.zip('my-photos.zip');
 * ```
 */

import type {
  ZipItOptions,
  ZipItInstance,
  AddFileOptions,
  FileEntry,
  ProgressHandler,
  CompleteHandler,
  ErrorHandler,
  FileProgressHandler,
} from '../types';
import { StateStore } from '../store/StateStore';
import { DownloadEngine } from './DownloadEngine';
import { ZipEngine } from '../zip/ZipEngine';
import { filenameFromUrl, idFromUrl, isValidUrl, sanitizeFilename } from '../utils/helpers';
import { ZipItError } from '../types';
import {
  supportsOPFS,
  supportsFileSystemAccess,
} from '../utils/capabilities';

const DEFAULT_OPTIONS: Required<ZipItOptions> = {
  concurrency: 3,
  zipBackpressureLimit: 10,
  streamBufferBytes: 5 * 1024 * 1024,
  dbName: 'zipit_v1',
  onProgress: undefined as unknown as ProgressHandler,
  onComplete: undefined as unknown as CompleteHandler,
  onError: undefined as unknown as ErrorHandler,
  onFileProgress: undefined as unknown as FileProgressHandler,
  onFileRemoved: undefined as unknown as FileProgressHandler,
  fetchTimeoutMs: 30000,
  maxRetriesPerFile: 3,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
  hydrateTimeoutMs: 5000,
  debug: false,
  allowedProtocols: ['https:', 'http:'],
};

/**
 * Create a new ZipIt instance.
 *
 * @param options - Configuration for concurrency, buffering, and event handlers.
 * @returns A `ZipItInstance` with the full public API.
 *
 * @example
 * const ds = createZipIt({ concurrency: 4, onProgress: console.log });
 */
export function createZipIt(options: ZipItOptions = {}): ZipItInstance {
  const resolved: Required<ZipItOptions> = { ...DEFAULT_OPTIONS, ...options };

  const store = new StateStore(resolved.dbName);
  const engine = new DownloadEngine(resolved, store);
  const zipEngine = new ZipEngine({
    maxInFlight: resolved.zipBackpressureLimit,
    streamBufferBytes: resolved.streamBufferBytes,
    onFileStart: (req) => {
      if (req.opfsId) engine.setFileZipping(req.opfsId, true);
    },
    onFileEnd: (req) => {
      if (req.opfsId) engine.setFileZipping(req.opfsId, false);
    },
  });

  // Register top-level option handlers
  if (resolved.onProgress) engine.on('progress', resolved.onProgress);
  if (resolved.onComplete) engine.on('complete', resolved.onComplete);
  if (resolved.onError) engine.on('error', resolved.onError);
  if (resolved.onFileProgress) engine.on('file-progress', resolved.onFileProgress);
  if (resolved.onFileRemoved) engine.on('file-removed', resolved.onFileRemoved);

  // ─── Helper ───────────────────────────────────────────────────────────────

  function buildEntry(url: string, opts: AddFileOptions = {}): FileEntry {
    const id = idFromUrl(`${url}${opts.folder ?? ''}`);
    return {
      id,
      url,
      filename: sanitizeFilename(opts.filename ?? filenameFromUrl(url)),
      folder: opts.folder ? opts.folder.split('/').map(sanitizeFilename).join('/') : undefined,
      totalBytes: opts.totalBytes ?? 0,
      downloadedBytes: 0,
      status: 'idle',
      addedAt: Date.now(),
      retryCount: 0,
      metadata: opts.metadata,
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  const instance: ZipItInstance = {
    add(url, opts) {
      if (!isValidUrl(url, resolved.allowedProtocols)) {
        throw new ZipItError(`Invalid URL protocol: ${url}`, 'INVALID_URL');
      }

      const id = idFromUrl(`${url}${opts?.folder ?? ''}`);
      const existing = engine.getFile(id);

      if (existing) {
        if (existing.status === 'error') {
          engine.retry(id);
        }
        return existing;
      }

      const entry = buildEntry(url, opts);
      engine.addFile(entry);
      return entry;
    },

    async addAll(urls, opts) {
      const entries: FileEntry[] = [];
      for (const url of urls) {
        if (!isValidUrl(url, resolved.allowedProtocols)) continue;

        const id = idFromUrl(`${url}${opts?.folder ?? ''}`);
        const existing = engine.getFile(id);
        if (existing) {
          if (existing.status === 'error') engine.retry(id);
          continue;
        }

        entries.push(buildEntry(url, opts));
      }

      await engine.addFiles(entries);
      return entries;
    },

    async start(opts) {
      if (engine.isBusy()) {
        throw new ZipItError('ZipIt: start() called while already running.', 'ALREADY_RUNNING');
      }
      if (!supportsOPFS()) {
        throw new ZipItError('OPFS is not supported in this browser.', 'OPFS_UNAVAILABLE');
      }
      if (opts?.saveToFolder && !supportsFileSystemAccess()) {
        throw new ZipItError(
          'Native folder save is not supported in this browser. Use ds.zip() instead.',
          'FSA_UNAVAILABLE'
        );
      }
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

    async zip(outputFilename = 'zipit-archive.zip', opts = {}) {
      if (engine.isBusy() || zipEngine.isBusy) {
        throw new ZipItError('ZipIt: zip() called while already running.', 'ALREADY_RUNNING');
      }
      if (!supportsOPFS() && !resolved.debug) {
        throw new ZipItError('OPFS is not supported in this browser.', 'OPFS_UNAVAILABLE');
      }

      // 1. Start downloads in parallel (respecting concurrency)
      // This will download all queued files to OPFS.
      await engine.start();

      const files = Array.from(engine.getFiles().values());
      const requests = files.map((f) => ({
        url: f.url,
        fileName: f.folder ? `${f.folder}/${f.filename}` : f.filename,
        opfsId: f.id,
        waitForStream: async () => {
          const entry = await engine.waitForStaged(f.id, opts.signal);
          const rootDir = await navigator.storage.getDirectory();
          const handle = await rootDir.getFileHandle(entry.id);
          const file = await handle.getFile();
          return file.stream();
        },
      }));

      await zipEngine.streamArchive(outputFilename, requests, opts.signal);
    },

    async saveToFolder() {
      // @deprecated — use start({ saveToFolder: true })
      if (!('showDirectoryPicker' in window)) {
        throw new ZipItError(
          'Native folder save is not supported in this browser. Use ds.zip() instead.',
          'FSA_UNAVAILABLE'
        );
      }
      const handle = await (
        window as Window & { showDirectoryPicker: (opts: unknown) => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker({ mode: 'readwrite' });
      engine.setDirectoryHandle(handle);
    },

    retry(fileId: string) {
      engine.retry(fileId);
    },

    retryFailed() {
      engine.retryFailed();
    },

    async remove(fileId: string) {
      await engine.remove(fileId);
    },

    update(fileId: string, opts) {
      engine.update(fileId, opts);
    },

    getFile(fileId: string) {
      return engine.getFile(fileId);
    },

    async getStorageEstimate() {
      return engine.getStorageEstimate();
    },

    on(event: string, handler: unknown) {
      return engine.on(event as 'progress', handler as ProgressHandler);
    },

    off(event: string, handler: unknown) {
      engine.off(event as 'progress', handler as ProgressHandler);
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
