import type {
  DownloadWorkerInbound,
  DownloadWorkerOutbound,
  FileDescriptor,
  FileProgress,
  SessionState,
  ZipitConfig,
} from './types';
import OpfsStore from './storage/OpfsStore';
import SessionStore from './storage/SessionStore';
import DownloadWorker from './workers/download.worker?worker&inline';

interface QueueItem {
  file: FileDescriptor;
  startByte: number;
  attempt: number;
}

interface ActiveDownload {
  worker: Worker;
  item: QueueItem;
  progress: FileProgress;
}

type ProgressCallback = (progress: FileProgress) => void;
type CompleteCallback = (fileId: string) => void;
type ErrorCallback = (fileId: string, error: Error) => void;

/** Coordinates download workers, retry behavior, and persistent progress state. */
export class DownloadOrchestrator {
  private readonly queue: QueueItem[] = [];
  private readonly active = new Map<string, ActiveDownload>();
  private readonly descriptors = new Map<string, FileDescriptor>();
  private readonly progress = new Map<string, FileProgress>();
  private readonly progressCallbacks = new Set<ProgressCallback>();
  private readonly completeCallbacks = new Set<CompleteCallback>();
  private readonly errorCallbacks = new Set<ErrorCallback>();
  private readonly createdAt = Date.now();
  private isPaused = false;

  /**
   * Creates a download coordinator.
   *
   * @param config - Download concurrency and retry configuration.
   * @param sessionStore - IndexedDB-backed session persistence.
   * @param opfsStore - OPFS-backed partial byte storage.
   */
  constructor(
    private readonly config: ZipitConfig,
    private readonly sessionStore: SessionStore,
    private readonly opfsStore: OpfsStore
  ) {}

  /**
   * Adds files to the queue and persists initial progress.
   *
   * Existing partial files in OPFS are used to compute resume offsets.
   *
   * @param files - File descriptors to enqueue.
   */
  async enqueue(files: FileDescriptor[]): Promise<void> {
    for (const file of files) {
      this.descriptors.set(file.id, file);
    }

    await this.sessionStore.saveSession(this.buildSession('idle'));

    for (const file of files) {
      const startByte = await this.opfsStore.getDownloadedBytes(file.id);
      const progress: FileProgress = {
        fileId: file.id,
        phase: 'pending',
        downloadedBytes: startByte,
        totalBytes: file.sizeBytes,
      };

      this.progress.set(file.id, progress);
      this.queue.push({ file, startByte, attempt: 0 });
      await this.sessionStore.saveFileProgress(progress);
      this.emitProgress(progress);
    }
  }

  /** Starts processing the queue up to the configured concurrency limit. */
  start(): void {
    this.isPaused = false;
    void this.sessionStore.saveSession(this.buildSession('running'));
    this.drainQueue();
  }

  /** Aborts active workers and persists their current byte offsets. */
  pause(): void {
    this.isPaused = true;
    void this.sessionStore.saveSession(this.buildSession('paused'));
    for (const [fileId, active] of this.active) {
      active.worker.postMessage({
        type: 'AbortDownload',
        fileId,
      } satisfies DownloadWorkerInbound);
      void this.sessionStore.saveFileProgress(active.progress);
    }
  }

  /** Rebuilds the queue from persisted progress and resumes downloading. */
  async resume(): Promise<void> {
    const session = await this.sessionStore.getSession(this.opfsStore.sessionId);
    if (session) {
      for (const file of session.files) {
        this.descriptors.set(file.id, file);
      }
    }

    const storedProgress = await this.sessionStore.getFileProgress(this.opfsStore.sessionId);
    this.queue.length = 0;

    for (const progress of storedProgress) {
      const file = this.descriptors.get(progress.fileId);
      if (!file || progress.phase === 'done') {
        continue;
      }
      const startByte = await this.opfsStore.getDownloadedBytes(progress.fileId);
      this.progress.set(progress.fileId, {
        ...progress,
        phase: 'pending',
        downloadedBytes: startByte,
      });
      this.queue.push({ file, startByte, attempt: 0 });
    }

    this.start();
  }

  /**
   * Registers a callback for file progress changes.
   *
   * @param callback - Callback invoked for each progress update.
   * @returns An unsubscribe function.
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * Registers a callback for file completion.
   *
   * @param callback - Callback invoked with a completed file id.
   * @returns An unsubscribe function.
   */
  onFileComplete(callback: CompleteCallback): () => void {
    this.completeCallbacks.add(callback);
    return () => this.completeCallbacks.delete(callback);
  }

  /**
   * Registers a callback for terminal file errors.
   *
   * @param callback - Callback invoked with the failed file id and error.
   * @returns An unsubscribe function.
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  private drainQueue(): void {
    if (this.isPaused) {
      return;
    }

    while (this.active.size < this.config.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) return;
      this.startItem(item);
    }
  }

  private startItem(item: QueueItem): void {
    const worker = new DownloadWorker();
    const progress: FileProgress = {
      fileId: item.file.id,
      phase: 'downloading',
      downloadedBytes: item.startByte,
      totalBytes: item.file.sizeBytes,
    };

    this.active.set(item.file.id, { worker, item, progress });
    this.progress.set(item.file.id, progress);
    void this.sessionStore.saveFileProgress(progress);
    this.emitProgress(progress);

    worker.onmessage = (event: MessageEvent<DownloadWorkerOutbound>) => {
      void this.handleWorkerMessage(event.data);
    };

    worker.postMessage({
      type: 'StartChunk',
      fileId: item.file.id,
      url: item.file.url,
      startByte: item.startByte,
      sessionId: this.opfsStore.sessionId,
    } satisfies DownloadWorkerInbound);
  }

  private async handleWorkerMessage(message: DownloadWorkerOutbound): Promise<void> {
    const active = this.active.get(message.fileId);
    if (!active) {
      return;
    }

    switch (message.type) {
      case 'ChunkProgress': {
        const progress: FileProgress = {
          ...active.progress,
          downloadedBytes: active.item.startByte + message.bytesReceived,
        };
        active.progress = progress;
        this.progress.set(message.fileId, progress);
        await this.sessionStore.saveFileProgress(progress);
        this.emitProgress(progress);
        break;
      }

      case 'ChunkDone': {
        active.worker.terminate();
        this.active.delete(message.fileId);

        const downloadedBytes = await this.opfsStore.getDownloadedBytes(message.fileId);
        const progress: FileProgress = {
          ...active.progress,
          phase: 'done',
          downloadedBytes,
          totalBytes: active.item.file.sizeBytes ?? downloadedBytes,
        };
        this.progress.set(message.fileId, progress);
        await this.sessionStore.saveFileProgress(progress);
        this.emitProgress(progress);
        this.completeCallbacks.forEach((callback) => callback(message.fileId));
        this.markSessionDoneIfComplete();
        this.drainQueue();
        break;
      }

      case 'ChunkError':
        await this.handleWorkerError(active, message.error, message.retryable);
        break;
    }
  }

  private async handleWorkerError(
    active: ActiveDownload,
    message: string,
    retryable: boolean
  ): Promise<void> {
    active.worker.terminate();
    this.active.delete(active.item.file.id);

    if (this.isPaused && message === 'aborted') {
      const progress: FileProgress = {
        ...active.progress,
        phase: 'pending',
        downloadedBytes: await this.opfsStore.getDownloadedBytes(active.item.file.id),
      };
      this.progress.set(active.item.file.id, progress);
      await this.sessionStore.saveFileProgress(progress);
      this.emitProgress(progress);
      return;
    }

    if (retryable && active.item.attempt < this.config.retryAttempts) {
      const attempt = active.item.attempt + 1;
      const delay = this.config.retryDelayMs * 2 ** active.item.attempt;
      await sleep(delay);
      this.queue.unshift({
        file: active.item.file,
        startByte: await this.opfsStore.getDownloadedBytes(active.item.file.id),
        attempt,
      });
      this.drainQueue();
      return;
    }

    const error = new Error(message);
    const progress: FileProgress = {
      ...active.progress,
      phase: 'error',
      error,
      downloadedBytes: await this.opfsStore.getDownloadedBytes(active.item.file.id),
    };
    this.progress.set(active.item.file.id, progress);
    await this.sessionStore.saveFileProgress(progress);
    await this.sessionStore.saveSession(this.buildSession('error'));
    this.emitProgress(progress);
    this.errorCallbacks.forEach((callback) => callback(active.item.file.id, error));
    this.drainQueue();
  }

  private emitProgress(progress: FileProgress): void {
    this.progressCallbacks.forEach((callback) => callback(progress));
  }

  private buildSession(status: SessionState['status']): SessionState {
    return {
      sessionId: this.opfsStore.sessionId,
      files: Array.from(this.descriptors.values()),
      status,
      createdAt: this.createdAt,
    };
  }

  private voidSessionSave(status: SessionState['status']): void {
    void this.sessionStore.saveSession(this.buildSession(status));
  }

  private markSessionDoneIfComplete(): void {
    const values = Array.from(this.progress.values());
    if (values.length > 0 && values.every((progress) => progress.phase === 'done')) {
      this.voidSessionSave('done');
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default DownloadOrchestrator;
