/**
 * DownloadEngine — the OPFS-backed multi-threaded download manager.
 *
 * Manages the full lifecycle:
 *   queued → downloading (OPFS) → staged → transferring (local disk) → done
 *
 * @internal
 */

import type {
  FileDescriptor,
  FileProgress,
  GlobalProgress,
  ZipitConfig,
  ProgressHandler,
  ErrorHandler,
  DownloadWorkerInbound,
  DownloadWorkerOutbound,
} from '../types';
import { StateStore } from '../store/StateStore';
import { rafThrottle } from '../utils/helpers';

type EventMap = {
  progress: ProgressHandler[];
  error: ErrorHandler[];
  'file-progress': ((progress: FileProgress) => void)[];
};

export class DownloadEngine {
  private store: StateStore;
  private descriptors = new Map<string, FileDescriptor>();
  private progresses = new Map<string, FileProgress>();
  private queue: string[] = [];
  private activeWorkers = new Map<string, Worker>();
  private activeTransfers = new Set<string>();
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private concurrency: number;
  private _isPaused = false;
  private listeners: EventMap = {
    progress: [],
    error: [],
    'file-progress': [],
  };

  // Speed tracking (rolling 3s window)
  private speedSamples: { time: number; bytes: number }[] = [];

  private emitProgress: () => void;

  constructor(options: ZipitConfig, store: StateStore) {
    this.store = store;
    this.concurrency = options.concurrency;

    // Throttle progress reporting to animation frames
    this.emitProgress = rafThrottle(() => {
      const stats = this.buildStats();
      this.listeners.progress.forEach((h) => h(stats));

      if (stats.completedFiles === stats.totalFiles && stats.totalFiles > 0 && stats.phase === 'done') {
        // Auto-cleanup
        this.store.clearAll().catch(console.error);
      }
    });
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

  addFile(descriptor: FileDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
    if (!this.progresses.has(descriptor.id)) {
      this.progresses.set(descriptor.id, {
        fileId: descriptor.id,
        phase: 'pending',
        downloadedBytes: 0,
        totalBytes: descriptor.sizeBytes,
      });
    }
    if (!this.queue.includes(descriptor.id)) {
      this.queue.push(descriptor.id);
    }
    this.store.upsert(descriptor).catch(console.error);
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

    // Update queued files to 'pending' phase if idle
    for (const id of this.queue) {
      const progress = this.progresses.get(id);
      if (progress && progress.phase === 'pending') {
        this.updateFileProgress(id, { phase: 'pending' });
      }
    }

    this._isPaused = false;
    this.processQueue();
  }

  pause(): void {
    this._isPaused = true;
    for (const [id, worker] of this.activeWorkers) {
      worker.postMessage({ type: 'ABORT_DOWNLOAD', id } satisfies DownloadWorkerInbound);
    }
  }

  resume(): void {
    this._isPaused = false;
    this.processQueue();
  }

  cancel(): void {
    this._isPaused = true;
    for (const [id, worker] of this.activeWorkers) {
      worker.postMessage({ type: 'ABORT_DOWNLOAD', id } satisfies DownloadWorkerInbound);
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

  getFiles(): FileDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  getProgress(): GlobalProgress {
    return this.buildStats();
  }

  async hydrate(): Promise<FileDescriptor[]> {
    const stored = await this.store.getAll() as FileDescriptor[];
    const resumable: FileDescriptor[] = [];

    for (const descriptor of stored) {
      this.descriptors.set(descriptor.id, descriptor);
      
      // For hydration, we'll assume they need to be re-downloaded or transferred
      // In a real app we might store progress too, but following the "static vs dynamic" split
      this.progresses.set(descriptor.id, {
        fileId: descriptor.id,
        phase: 'pending',
        downloadedBytes: 0,
        totalBytes: descriptor.sizeBytes,
      });
      this.queue.push(descriptor.id);
      resumable.push(descriptor);
    }

    this.emitProgress();
    return resumable;
  }

  async reset(): Promise<void> {
    this.cancel();
    this.descriptors.clear();
    this.progresses.clear();
    this.queue = [];
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
      const descriptor = this.descriptors.get(nextId);
      const progress = this.progresses.get(nextId);
      if (!descriptor || !progress) continue;

      if (progress.phase === 'staging' && this.directoryHandle) {
        void this.transferToLocalDisk(descriptor);
      } else if (progress.phase !== 'staging' && progress.phase !== 'done') {
        this.startWorker(descriptor);
      }
    }

    this.emitProgress();
  }

  private startWorker(descriptor: FileDescriptor): void {
    const worker = new Worker(
      new URL('../workers/download.worker.js', import.meta.url),
      { type: 'module' }
    );
    this.activeWorkers.set(descriptor.id, worker);
    this.updateFileProgress(descriptor.id, { phase: 'downloading' });

    worker.onmessage = async (event: MessageEvent<DownloadWorkerOutbound>) => {
      const msg = event.data;
      const currentProgress = this.progresses.get(descriptor.id);
      if (!currentProgress) return;

      switch (msg.type) {
        case 'CHUNK_PROGRESS':
          this.trackSpeed(msg.loaded - currentProgress.downloadedBytes);
          this.updateFileProgress(descriptor.id, { downloadedBytes: msg.loaded });
          break;

        case 'CHUNK_DONE':
          this.activeWorkers.delete(descriptor.id);
          worker.terminate();
          this.updateFileProgress(descriptor.id, { 
            phase: 'staging', 
            downloadedBytes: msg.size,
            totalBytes: msg.size 
          });
          if (this.directoryHandle) {
            void this.transferToLocalDisk(this.descriptors.get(descriptor.id)!);
          }
          this.processQueue();
          break;

        case 'CHUNK_ERROR': {
          const fileError = new Error(msg.message);
          this.activeWorkers.delete(descriptor.id);
          worker.terminate();
          this.updateFileProgress(descriptor.id, { phase: 'error', error: msg.message });
          this.listeners.error.forEach((h) => h(fileError, descriptor.id));
          this.processQueue();
          break;
        }
      }
    };

    worker.postMessage({
      type: 'START_CHUNK',
      id: descriptor.id,
      url: descriptor.url,
      startByte: currentProgress.downloadedBytes || 0,
    } satisfies DownloadWorkerInbound);
  }

  private async transferToLocalDisk(descriptor: FileDescriptor): Promise<void> {
    this.activeTransfers.add(descriptor.id);
    // 'staging' is used for both OPFS and transferring to local disk in this simplified model
    // or we could add a 'transferring' phase to FilePhase if needed. 
    // For now let's keep it as 'staging'.

    try {
      const rootDir = await navigator.storage.getDirectory();
      const opfsHandle = await rootDir.getFileHandle(descriptor.id);
      const opfsFile = await opfsHandle.getFile();

      const pathParts = descriptor.path.split('/');
      const filename = pathParts.pop()!;
      const folder = pathParts.join('/');

      const targetDir = await this.resolveTargetDir(folder);
      const localHandle = await targetDir.getFileHandle(filename, { create: true });
      const writable = await localHandle.createWritable();
      await opfsFile.stream().pipeTo(writable);

      // Clean up OPFS entry
      await rootDir.removeEntry(descriptor.id);

      this.updateFileProgress(descriptor.id, { phase: 'done' });
    } catch (err: unknown) {
      const e = err as Error;
      this.updateFileProgress(descriptor.id, { phase: 'error', error: e.message });
      this.listeners.error.forEach((h) => h(e, descriptor.id));
    } finally {
      this.activeTransfers.delete(descriptor.id);
      this.emitProgress();
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

  private updateFileProgress(id: string, updates: Partial<FileProgress>): void {
    const existing = this.progresses.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    this.progresses.set(id, updated);
    this.listeners['file-progress'].forEach((h) => h(updated));
    this.emitProgress();
  }

  private trackSpeed(byteDelta: number): void {
    if (byteDelta <= 0) return;
    const now = Date.now();
    this.speedSamples.push({ time: now, bytes: byteDelta });
    // Keep only last 3 seconds
    const cutoff = now - 3000;
    this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff);
  }

  private buildStats(): GlobalProgress {
    const allProgress = Array.from(this.progresses.values());
    const totalFiles = allProgress.length;
    const completedFiles = allProgress.filter((f) => f.phase === 'done').length;
    
    const totalBytes = allProgress.reduce((s, f) => s + (f.totalBytes || 0), 0);
    const downloadedBytes = allProgress.reduce((s, f) => s + (f.downloadedBytes || 0), 0);

    const speedBytesPerSecond = this.speedSamples.reduce((s, x) => s + x.bytes, 0) / 3;
    const remaining = totalBytes - downloadedBytes;
    const etaSeconds = speedBytesPerSecond > 0 ? remaining / speedBytesPerSecond : undefined;

    let phase: 'downloading' | 'zipping' | 'done' = 'downloading';
    if (completedFiles === totalFiles && totalFiles > 0) {
      phase = 'done';
    }

    return {
      totalFiles,
      completedFiles,
      totalBytes: totalBytes || undefined,
      downloadedBytes,
      speedBytesPerSecond,
      etaSeconds: etaSeconds ?? undefined,
      phase,
    };
  }
}
