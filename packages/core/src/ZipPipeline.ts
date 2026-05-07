import type { FileDescriptor, ZipitConfig } from './types';
import OpfsStore from './storage/OpfsStore';
import { FileSystemWriter, type IFileSystemWriter } from './fs/FileSystemWriter';
import ZipWorker from './workers/zip.worker?worker&inline';

interface ZipProgressPayload {
  compressedBytes: number;
  totalBytes: number;
}

type FileZippedResolver = {
  resolve: () => void;
  reject: (error: Error) => void;
};

/** Connects OPFS input, ZIP worker compression, and output file writing. */
export class ZipPipeline {
  private readonly progressCallbacks = new Set<(p: ZipProgressPayload) => void>();
  private readonly fileResolvers = new Map<string, FileZippedResolver>();
  private readonly pendingOperations: Array<() => Promise<void>> = [];
  private queueActive = false;
  private worker: Worker | null = null;
  private writer: IFileSystemWriter | null = null;
  private writerChannel: MessageChannel | null = null;
  private preparePromise: Promise<void> | null = null;
  private finalizeResolver: FileZippedResolver | null = null;
  private finalizeWait: Promise<void> | null = null;
  private finalized = false;
  private aborted = false;
  private finalSizeBytes = 0;
  private currentOpfsAckResolver: (() => void) | null = null;

  constructor(
    private readonly config: Pick<ZipitConfig, 'compressionLevel'>,
    private readonly opfsStore: OpfsStore
  ) {}

  /**
   * Prepares the pipeline and opens the destination file.
   *
   * @param suggestedZipName - Name suggested to the save dialog.
   */
  async prepare(suggestedZipName: string): Promise<void> {
    if (this.preparePromise) {
      await this.preparePromise;
      return;
    }

    this.preparePromise = (async () => {
      this.writer = await FileSystemWriter.requestSaveFile(suggestedZipName);
      this.writerChannel = new MessageChannel();
      this.worker = new ZipWorker();

      this.writerChannel.port1.onmessage = async (
        event: MessageEvent<{ type: 'ZipData'; chunk: Uint8Array }>
      ) => {
        if (!this.writer) return;
        if (event.data.type === 'ZipData') {
          try {
            await this.writer.write(event.data.chunk);
            this.writerChannel?.port1.postMessage({ type: 'WriterDrain' });
          } catch (error) {
            const writeError = error instanceof Error ? error : new Error(String(error));
            this.fileResolvers.forEach((resolver) => resolver.reject(writeError));
            this.fileResolvers.clear();
            this.finalizeResolver?.reject(writeError);
            this.finalizeResolver = null;
            await this.abort();
          }
        }
      };

      this.worker.onmessage = (event: MessageEvent) => {
        const message = event.data as
          | { type: 'FileZipped'; fileId: string }
          | { type: 'ZipProgress'; compressedBytes: number; totalBytes: number }
          | { type: 'ZipDone'; finalSizeBytes: number }
          | { type: 'ZipError'; error: string }
          | { type: 'ZIP_DONE'; blob: Blob }
          | { type: 'ZIP_ERROR'; message: string }
          | { type: 'ZIP_PROGRESS'; progress: number };

        if (message.type === 'ZipProgress') {
          this.progressCallbacks.forEach((callback) => callback(message));
          return;
        }

        if (message.type === 'FileZipped') {
          this.fileResolvers.get(message.fileId)?.resolve();
          this.fileResolvers.delete(message.fileId);
          return;
        }

        if (message.type === 'ZipDone') {
          this.finalSizeBytes = message.finalSizeBytes;
          this.finalizeResolver?.resolve();
          this.finalizeResolver = null;
          return;
        }

        if (message.type === 'ZipError' || message.type === 'ZIP_ERROR') {
          const error = new Error(message.type === 'ZipError' ? message.error : message.message);
          this.currentOpfsAckResolver?.();
          this.currentOpfsAckResolver = null;
          this.worker?.terminate();
          this.worker = null;
          void this.writer?.abort(error.message);
          this.fileResolvers.forEach((resolver) => resolver.reject(error));
          this.fileResolvers.clear();
          this.finalizeResolver?.reject(error);
          this.finalizeResolver = null;
        }
      };

      this.worker.postMessage(
        {
          type: 'Init',
          writerPort: this.writerChannel.port2,
          compressionLevel: this.config.compressionLevel,
        },
        [this.writerChannel.port2]
      );
    })();

    await this.preparePromise;
  }

  /**
   * Streams a file from OPFS into the ZIP worker.
   *
   * @param file - File to add.
   */
  async addFile(file: FileDescriptor): Promise<void> {
    await this.enqueue(async () => {
      this.assertReady();
      const fileDone = new Promise<void>((resolve, reject) => {
        this.fileResolvers.set(file.id, { resolve, reject });
      });

      const opfsChannel = new MessageChannel();
      const reader = (await this.opfsStore.readFile(file.id)).getReader();

      opfsChannel.port1.onmessage = (event: MessageEvent<{ type: 'OpfsAck' } | { type: 'OpfsError'; error: string }>) => {
        if (event.data.type === 'OpfsAck') {
          const resolve = this.currentOpfsAckResolver;
          this.currentOpfsAckResolver = null;
          resolve?.();
        } else {
          const resolver = this.fileResolvers.get(file.id);
          resolver?.reject(new Error(event.data.error));
          this.fileResolvers.delete(file.id);
        }
      };

      this.worker?.postMessage(
        {
          type: 'AddFile',
          fileId: file.id,
          path: file.path,
          size: file.sizeBytes ?? 0,
          opfsPort: opfsChannel.port2,
        },
        [opfsChannel.port2]
      );

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            opfsChannel.port1.postMessage({ type: 'OpfsEnd' });
            break;
          }

          const chunk = this.transferableChunk(value);
          const ack = new Promise<void>((resolve) => {
            this.currentOpfsAckResolver = resolve;
          });
          opfsChannel.port1.postMessage({ type: 'OpfsChunk', chunk }, [chunk.buffer]);
          await ack;
        }
      } finally {
        reader.releaseLock();
      }

      await fileDone;
    });
  }

  /**
   * Finalizes the archive and closes the destination writer.
   *
   * @returns Final ZIP size in bytes.
   */
  async finalize(): Promise<{ finalSizeBytes: number }> {
    await this.preparePromise;
    this.assertReady();

    this.finalizeWait = new Promise<void>((resolve, reject) => {
      this.finalizeResolver = { resolve, reject };
    });
    this.worker?.postMessage({ type: 'Finalize' });
    await this.finalizeWait;
    await this.writer?.close();
    this.worker?.terminate();
    this.worker = null;
    this.writerChannel?.port1.close();
    this.writerChannel?.port2.close();
    this.writerChannel = null;
    this.finalized = true;
    return { finalSizeBytes: this.finalSizeBytes || this.writer?.getBytesWritten() || 0 };
  }

  /**
   * Registers progress updates from the ZIP worker.
   *
   * @param callback - Receives compressed and total byte counts.
   * @returns An unsubscribe function.
   */
  onProgress(callback: (p: ZipProgressPayload) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /** Aborts the active worker and destination writer. */
  async abort(): Promise<void> {
    this.aborted = true;
    this.currentOpfsAckResolver?.();
    this.currentOpfsAckResolver = null;
    const abortedError = new Error('aborted');
    this.fileResolvers.forEach((resolver) => resolver.reject(abortedError));
    this.fileResolvers.clear();
    this.finalizeResolver?.reject(abortedError);
    this.finalizeResolver = null;
    this.worker?.terminate();
    this.worker = null;
    this.writerChannel?.port1.close();
    this.writerChannel?.port2.close();
    this.writerChannel = null;
    await this.writer?.abort('aborted');
  }

  private async enqueue(task: () => Promise<void>): Promise<void> {
    this.pendingOperations.push(task);
    if (this.queueActive) return;

    this.queueActive = true;
    try {
      while (this.pendingOperations.length > 0) {
        const next = this.pendingOperations.shift();
        if (next) {
          await next();
        }
      }
    } finally {
      this.queueActive = false;
    }
  }

  private assertReady(): void {
    if (this.aborted) {
      throw new Error('ZipPipeline has been aborted');
    }
    if (!this.worker || !this.writer || !this.writerChannel) {
      throw new Error('ZipPipeline is not prepared');
    }
    if (this.finalized) {
      throw new Error('ZipPipeline is already finalized');
    }
  }

  private transferableChunk(chunk: Uint8Array): Uint8Array {
    return chunk.byteOffset === 0 && chunk.byteLength === chunk.buffer.byteLength
      ? chunk
      : new Uint8Array(chunk);
  }
}

export default ZipPipeline;
