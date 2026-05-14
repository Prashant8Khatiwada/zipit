/**
 * DownloadEngine — the OPFS-backed multi-threaded download manager.
 *
 * Manages the full lifecycle:
 *   queued → downloading (OPFS) → staged → transferring (local disk) → done
 *
 * @internal
 */

import { ZipItError, type FileEntry, type ZipItOptions, type ProgressStats, type ProgressHandler, type CompleteHandler, type ErrorHandler, type FileProgressHandler, type AddFileOptions } from '../types';
import { StateStore } from '../store/StateStore';
import { rafThrottle } from '../utils/helpers';
import type { WorkerInMessage, WorkerOutMessage } from '../workers/download.worker';

type EventMap = {
  progress: ProgressHandler[];
  complete: CompleteHandler[];
  error: ErrorHandler[];
  'file-progress': FileProgressHandler[];
  'file-removed': FileProgressHandler[];
};

export class DownloadEngine {
  private store: StateStore;
  private files = new Map<string, FileEntry>();
  private queue: string[] = [];
  private activeWorkers = new Map<string, Worker>();
  private activeTransfers = new Set<string>();
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private _isPaused = false;
  private concurrency: number;
  private debug: boolean;
  private fetchTimeoutMs: number;
  private maxRetriesPerFile: number;
  private retryDelayMs: number;
  private retryBackoffMultiplier: number;
  private hydrateTimeoutMs: number;
  private workerUrl?: string | URL;

  private listeners: EventMap = {
    progress: [],
    complete: [],
    error: [],
    'file-progress': [],
    'file-removed': [],
  };

  // O(1) Stats accumulators
  private _totalBytes = 0;
  private _downloadedBytes = 0;
  private _completedFiles = 0;
  private _stagedFiles = 0;
  private _activeFiles = 0;
  private _zippingFiles = 0;

  // Speed tracking (EMA)
  private speedEma = 0;
  private lastProgressTime = 0;
  private sessionStartTime = 0;

  private emitProgress: () => void;

  constructor(options: Required<ZipItOptions>, store: StateStore) {
    this.store = store;
    this.concurrency = options.concurrency;
    this.debug = !!options.debug;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? 30000;
    this.maxRetriesPerFile = options.maxRetriesPerFile ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.retryBackoffMultiplier = options.retryBackoffMultiplier ?? 2;
    this.hydrateTimeoutMs = options.hydrateTimeoutMs ?? 5000;
    this.workerUrl = options.workerUrls?.download;

    // Throttle progress reporting to animation frames
    this.emitProgress = rafThrottle(() => {
      const stats = this.buildStats();
      this.listeners.progress.forEach((h) => h(stats));

      if (stats.completedFiles === stats.totalFiles && stats.totalFiles > 0) {
        this.listeners.complete.forEach((h) => h(stats));
      }
    });
  }

  private log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.debug(`[zipit] ${message}`, ...args);
    }
  }

  // ─── Event system ──────────────────────────────────────────────────────────

  on<K extends keyof EventMap>(event: K, handler: EventMap[K][number]): () => void {
    (this.listeners[event] as unknown[]).push(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventMap[K][number]): void {
    (this.listeners[event] as unknown[]) = (this.listeners[event] as unknown[]).filter(
      (h) => h !== handler
    );
  }

  // ─── File queue management ──────────────────────────────────────────────────

  addFile(entry: FileEntry): void {
    if (this.files.has(entry.id)) return;
    this.log(`file-added id=${entry.id} url=${entry.url}`);
    this.files.set(entry.id, entry);
    this._totalBytes += entry.totalBytes;
    if (!this.queue.includes(entry.id)) {
      this.queue.push(entry.id);
    }
    this.store.upsert(entry).catch(console.error);
    this.emitProgress();
  }

  async addFiles(entries: FileEntry[]): Promise<void> {
    const newEntries = entries.filter((e) => !this.files.has(e.id));
    if (newEntries.length === 0) return;

    for (const entry of newEntries) {
      this.log(`file-added id=${entry.id} url=${entry.url}`);
      this.files.set(entry.id, entry);
      this._totalBytes += entry.totalBytes;
      if (!this.queue.includes(entry.id)) {
        this.queue.push(entry.id);
      }
    }

    await this.store.upsertAll(newEntries);
    this.emitProgress();
  }

  // ─── Download lifecycle ────────────────────────────────────────────────────

  async start(options: { saveToFolder?: boolean } = {}): Promise<void> {
    if (options.saveToFolder && 'showDirectoryPicker' in window) {
      try {
        this.directoryHandle = await (
          window as Window & { showDirectoryPicker: (opts: unknown) => Promise<FileSystemDirectoryHandle> }
        ).showDirectoryPicker({ mode: 'readwrite' });
      } catch (err: unknown) {
        const e = err as Error;
        if (e.name !== 'AbortError') throw e;
      }
    }

    // Update queued files to 'queued' status
    for (const id of this.queue) {
      const entry = this.files.get(id);
      if (entry && entry.status === 'idle') {
        this.updateFile(id, { status: 'queued' });
      }
    }

    this._isPaused = false;
    this.sessionStartTime = Date.now();
    this.lastProgressTime = Date.now();
    this.processQueue();
  }

  pause(): void {
    this._isPaused = true;
    for (const [id, worker] of this.activeWorkers) {
      worker.postMessage({ type: 'pause', id } satisfies WorkerInMessage);
    }
  }

  resume(): void {
    this._isPaused = false;
    this.processQueue();
  }

  cancel(): void {
    this._isPaused = true;
    for (const [id, worker] of this.activeWorkers) {
      worker.postMessage({ type: 'pause', id } satisfies WorkerInMessage);
      worker.terminate();
    }
    this.activeWorkers.clear();
    this.queue = [];
  }

  setDirectoryHandle(handle: FileSystemDirectoryHandle): void {
    this.directoryHandle = handle;
    if (!this._isPaused) this.processQueue();
  }

  isPaused(): boolean { return this._isPaused; }

  isBusy(): boolean {
    return this.activeWorkers.size > 0 || this.queue.length > 0 || this.activeTransfers.size > 0;
  }

  getFiles(): Map<string, FileEntry> {
    return new Map(this.files);
  }

  getProgress(): ProgressStats {
    return this.buildStats();
  }

  getFile(fileId: string): FileEntry | undefined {
    return this.files.get(fileId);
  }

  async getStorageEstimate(): Promise<StorageEstimate> {
    if (navigator.storage && navigator.storage.estimate) {
      return await navigator.storage.estimate();
    }
    return { usage: 0, quota: Infinity };
  }

  retry(fileId: string): void {
    const entry = this.files.get(fileId);
    if (!entry) throw new ZipItError(`File not found: ${fileId}`, 'FILE_NOT_FOUND', fileId);
    if (entry.status !== 'error') {
      throw new ZipItError(`File is not in error status: ${fileId}`, 'FILE_NOT_RETRYABLE', fileId);
    }

    this.log(`retry id=${fileId}`);
    this.updateFile(fileId, { status: 'queued', errorMessage: undefined });
    if (!this.queue.includes(fileId)) {
      this.queue.push(fileId);
    }
    this.processQueue();
  }

  retryFailed(): void {
    const failed = Array.from(this.files.values()).filter((f) => f.status === 'error');
    if (failed.length === 0) return;

    this.log(`retry-failed count=${failed.length}`);
    for (const entry of failed) {
      this.updateFile(entry.id, { status: 'queued', errorMessage: undefined });
      if (!this.queue.includes(entry.id)) {
        this.queue.push(entry.id);
      }
    }
    this.processQueue();
  }

  async remove(fileId: string): Promise<void> {
    const entry = this.files.get(fileId);
    if (!entry) throw new ZipItError(`File not found: ${fileId}`, 'FILE_NOT_FOUND', fileId);

    this.log(`remove id=${fileId}`);

    // 1. Cancel active download
    const worker = this.activeWorkers.get(fileId);
    if (worker) {
      worker.terminate();
      this.activeWorkers.delete(fileId);
    }

    // 2. Delete from OPFS if staged/transferring
    if (entry.status === 'staged' || entry.status === 'transferring' || entry.status === 'downloading') {
      try {
        const rootDir = await navigator.storage.getDirectory();
        await rootDir.removeEntry(fileId);
      } catch (e) {
        // Best effort cleanup
      }
    }

    // 3. Fire removed event before deletion
    const removedEntry = { ...entry, status: 'removed' as const };
    this.listeners['file-removed'].forEach((h) => h(removedEntry));

    // 4. Update accumulators
    this._totalBytes -= entry.totalBytes;
    this._downloadedBytes -= entry.downloadedBytes;
    if (entry.status === 'done') this._completedFiles--;
    if (entry.status === 'staged') this._stagedFiles--;
    if (entry.status === 'downloading') this._activeFiles--;

    // 5. Cleanup memory and IDB
    this.files.delete(fileId);
    this.queue = this.queue.filter((id) => id !== fileId);
    await this.store.delete(fileId);

    this.emitProgress();
    this.processQueue();
  }

  update(fileId: string, options: Partial<Pick<AddFileOptions, 'filename' | 'folder' | 'metadata'>>): void {
    const entry = this.files.get(fileId);
    if (!entry) throw new ZipItError(`File not found: ${fileId}`, 'FILE_NOT_FOUND', fileId);
    if (entry.status !== 'idle' && entry.status !== 'queued') {
      throw new ZipItError(`Cannot update file in status: ${entry.status}`, 'UNKNOWN', fileId);
    }

    this.log(`update id=${fileId}`, options);
    this.updateFile(fileId, options);
  }

  async hydrate(): Promise<FileEntry[]> {
    const timeout = new Promise<FileEntry[]>((resolve) => {
      setTimeout(() => {
        this.log('hydrate() timed out — IndexedDB may be unavailable');
        resolve([]);
      }, this.hydrateTimeoutMs);
    });

    const storedPromise = this.store.getAll();
    const stored = await Promise.race([storedPromise, timeout]);
    const resumable: FileEntry[] = [];

    for (const entry of stored) {
      // Re-hydrate in-memory map
      this.files.set(entry.id, entry);

      if (entry.status === 'downloading' || entry.status === 'queued' || entry.status === 'paused' || entry.status === 'error') {
        // Reset to queued so they can be resumed
        const updated = { ...entry, status: 'queued' as const };
        this.files.set(entry.id, updated);
        this.queue.push(entry.id);
        resumable.push(updated);
      } else if (entry.status === 'staged') {
        this._stagedFiles++;
        // Was staged in OPFS, needs transfer
        if (this.directoryHandle) {
          void this.transferToLocalDisk(entry);
        } else {
          this.queue.push(entry.id);
          resumable.push(entry);
        }
      } else if (entry.status === 'done') {
        this._completedFiles++;
      }

      this._totalBytes += entry.totalBytes;
      this._downloadedBytes += entry.downloadedBytes;
    }

    this.emitProgress();
    return resumable;
  }

  async reset(): Promise<void> {
    this.cancel();
    this.files.clear();
    this.queue = [];
    this._totalBytes = 0;
    this._downloadedBytes = 0;
    this._completedFiles = 0;
    this._stagedFiles = 0;
    this._activeFiles = 0;
    this._zippingFiles = 0;
    this.speedEma = 0;
    await this.store.clearAll();
    // Clear OPFS cache
    try {
      const rootDir = await navigator.storage.getDirectory();
      for await (const [name] of (rootDir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
        await rootDir.removeEntry(name);
      }
    } catch {
      // OPFS cleanup best-effort
    }
  }

  // ─── Internal queue processing ─────────────────────────────────────────────

  private processQueue(): void {
    if (this._isPaused) return;

    while (this.activeWorkers.size < this.concurrency && this.queue.length > 0) {
      const nextId = this.queue.shift()!;
      const entry = this.files.get(nextId);
      if (!entry) continue;

      if (entry.status === 'staged' && this.directoryHandle) {
        void this.transferToLocalDisk(entry);
      } else if (entry.status === 'queued' || entry.status === 'paused' || entry.status === 'error') {
        this.startWorker(entry);
      }
    }

    this.emitProgress();
  }

  private startWorker(entry: FileEntry): void {
    let worker: Worker;
    try {
      const url = this.workerUrl || new URL('../workers/download.worker.ts', import.meta.url);
      worker = new Worker(url, { type: 'module' });
    } catch (err: unknown) {
      this.log(`worker-creation-failed id=${entry.id}`, err);
      const e = err as Error;
      const zipError = new ZipItError(
        `Failed to create worker: ${e.message}. Ensure the worker URL is correct.`,
        'WORKER_CRASHED',
        entry.id
      );
      this.updateFile(entry.id, { status: 'error', errorMessage: zipError.message });
      this.listeners.error.forEach((h) => h(zipError, this.files.get(entry.id)!));
      this.processQueue();
      return;
    }

    this.activeWorkers.set(entry.id, worker);
    this.updateFile(entry.id, { status: 'downloading' });

    worker.onerror = (event) => {
      this.log(`worker-crash id=${entry.id}`, event);
      this.activeWorkers.delete(entry.id);
      worker.terminate();
      const err = new ZipItError('Worker crashed — retry to resume', 'WORKER_CRASHED', entry.id);
      this.updateFile(entry.id, { status: 'error', errorMessage: err.message });
      this.listeners.error.forEach((h) => h(err, this.files.get(entry.id)!));
      this.processQueue();
    };

    worker.onmessage = async (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      this.log(`worker-message id=${entry.id} type=${msg.type}`);
      const current = this.files.get(entry.id);
      if (!current) return;

      switch (msg.type) {
        case 'progress': {
          const delta = msg.downloadedBytes - current.downloadedBytes;
          this.updateFile(entry.id, { downloadedBytes: msg.downloadedBytes });
          this.trackSpeed(delta);
          break;
        }

        case 'metadata_update':
          this.updateFile(entry.id, { totalBytes: msg.totalBytes });
          break;

        case 'completed':
          this.activeWorkers.delete(entry.id);
          worker.terminate();
          this.updateFile(entry.id, { status: 'staged', stagedAt: Date.now() });
          if (this.directoryHandle) {
            void this.transferToLocalDisk(this.files.get(entry.id)!);
          }
          this.processQueue();
          break;

        case 'error': {
          const isQuota = msg.code === 'QUOTA_EXCEEDED';
          const fileError = new ZipItError(
            msg.error,
            isQuota ? 'QUOTA_EXCEEDED' : 'FETCH_FAILED',
            entry.id
          );
          this.activeWorkers.delete(entry.id);
          worker.terminate();
          this.updateFile(entry.id, { status: 'error', errorMessage: msg.error });
          this.listeners.error.forEach((h) => h(fileError, this.files.get(entry.id)!));
          this.processQueue();
          break;
        }

        case 'paused':
          this.activeWorkers.delete(entry.id);
          worker.terminate();
          this.updateFile(entry.id, { status: 'paused' });
          this.processQueue();
          break;
      }
    };

    worker.postMessage({
      type: 'start',
      id: entry.id,
      url: entry.url,
      startByte: entry.downloadedBytes || 0,
      options: {
        fetchTimeoutMs: this.fetchTimeoutMs,
        maxRetries: this.maxRetriesPerFile,
        retryDelayMs: this.retryDelayMs,
        retryBackoffMultiplier: this.retryBackoffMultiplier,
      },
    } satisfies WorkerInMessage);
  }

  private async transferToLocalDisk(entry: FileEntry): Promise<void> {
    this.activeTransfers.add(entry.id);
    this.updateFile(entry.id, { status: 'transferring' });

    try {
      const rootDir = await navigator.storage.getDirectory();
      const opfsHandle = await rootDir.getFileHandle(entry.id);
      const opfsFile = await opfsHandle.getFile();

      const targetDir = await this.resolveTargetDir(entry.folder);
      const localHandle = await targetDir.getFileHandle(entry.filename, { create: true });
      const writable = await localHandle.createWritable();
      await opfsFile.stream().pipeTo(writable);

      // Clean up OPFS entry
      await rootDir.removeEntry(entry.id);

      this.updateFile(entry.id, { status: 'done', completedAt: Date.now() });
    } catch (err: unknown) {
      const e = err as Error;
      this.updateFile(entry.id, { status: 'error', errorMessage: e.message });
      const zipError = new ZipItError(e.message, 'FETCH_FAILED', entry.id);
      this.listeners.error.forEach((h) => h(zipError, this.files.get(entry.id)!));
    } finally {
      this.activeTransfers.delete(entry.id);
      this.emitProgress();
    }
  }

  setFileZipping(id: string, isZipping: boolean): void {
    const entry = this.files.get(id);
    if (!entry) return;

    if (isZipping) {
      this._zippingFiles++;
      this.updateFile(id, { status: 'transferring' });
    } else {
      this._zippingFiles--;
      this.updateFile(id, { status: 'done' });
    }
  }

  private async resolveTargetDir(folder?: string): Promise<FileSystemDirectoryHandle> {
    if (!this.directoryHandle) throw new Error('No directory handle');
    if (!folder) return this.directoryHandle;

    let current = this.directoryHandle;
    for (const part of folder.split('/').filter(Boolean)) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }

  // ─── State helpers ─────────────────────────────────────────────────────────

  async waitForStaged(id: string, signal?: AbortSignal): Promise<FileEntry> {
    const entry = this.files.get(id);
    if (!entry) throw new ZipItError(`File not found: ${id}`, 'FILE_NOT_FOUND', id);
    if (entry.status === 'staged' || entry.status === 'done' || entry.status === 'transferring') {
      return entry;
    }

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.off('file-progress', handler);
        this.off('error', errorHandler);
        signal?.removeEventListener('abort', abortHandler);
      };

      const handler = (updated: FileEntry) => {
        if (updated.id === id && (updated.status === 'staged' || updated.status === 'done' || updated.status === 'transferring')) {
          cleanup();
          resolve(updated);
        }
      };

      const errorHandler = (err: Error, file: FileEntry) => {
        if (file.id === id) {
          cleanup();
          reject(err);
        }
      };

      const abortHandler = () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };

      this.on('file-progress', handler);
      this.on('error', errorHandler);
      signal?.addEventListener('abort', abortHandler);
    });
  }

  private updateFile(id: string, updates: Partial<FileEntry>): void {
    const existing = this.files.get(id);
    if (!existing) return;

    const oldStatus = existing.status;
    const oldTotal = existing.totalBytes;
    const oldDownloaded = existing.downloadedBytes;

    const updated = { ...existing, ...updates };
    this.files.set(id, updated);

    // Update accumulators
    if (updates.status && updates.status !== oldStatus) {
      this.log(`file-status-change id=${id} old=${oldStatus} new=${updates.status}`);
      if (oldStatus === 'done') this._completedFiles--;
      if (oldStatus === 'staged') this._stagedFiles--;
      if (oldStatus === 'downloading') this._activeFiles--;
      if (oldStatus === 'transferring') { /* already handled or similar to zipping */ }

      if (updated.status === 'done') this._completedFiles++;
      if (updated.status === 'staged') this._stagedFiles++;
      if (updated.status === 'downloading') this._activeFiles++;
    }

    if (updates.totalBytes !== undefined) {
      this._totalBytes += (updates.totalBytes - oldTotal);
    }
    if (updates.downloadedBytes !== undefined) {
      this._downloadedBytes += (updates.downloadedBytes - oldDownloaded);
    }

    this.store.upsert(updated).catch(console.error);
    this.listeners['file-progress'].forEach((h) => h(updated));
    this.emitProgress();
  }

  private trackSpeed(byteDelta: number): void {
    if (byteDelta <= 0) return;
    const now = Date.now();
    const dt = (now - this.lastProgressTime) / 1000;
    this.lastProgressTime = now;

    if (dt > 0) {
      const currentSpeed = byteDelta / dt;
      // EMA alpha = 0.1
      const alpha = 0.1;
      this.speedEma = (alpha * currentSpeed) + ((1 - alpha) * this.speedEma);
    }
  }

  private buildStats(): ProgressStats {
    const speedBytesPerSecond = this.speedEma;
    const remaining = this._totalBytes - this._downloadedBytes;

    // Spec: Clamp etaSeconds to null for first 3 seconds, cap at 24h
    const sessionElapsed = (Date.now() - this.sessionStartTime) / 1000;
    let etaSeconds: number | null = null;

    if (sessionElapsed > 3 && speedBytesPerSecond > 0) {
      etaSeconds = remaining / speedBytesPerSecond;
      if (etaSeconds > 86400) etaSeconds = null; // Cap at 24h
    }

    return {
      totalFiles: this.files.size,
      completedFiles: this._completedFiles,
      stagedFiles: this._stagedFiles,
      activeFiles: this._activeFiles,
      zippingFiles: this._zippingFiles,
      totalBytes: this._totalBytes,
      downloadedBytes: this._downloadedBytes,
      overallProgress: this._totalBytes > 0 ? this._downloadedBytes / this._totalBytes : 0,
      speedBytesPerSecond,
      etaSeconds,
      files: new Map(this.files),
    };
  }
}
