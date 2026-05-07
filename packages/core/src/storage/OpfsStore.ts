/** Error thrown when OPFS rejects a write because storage quota is exhausted. */
export class ZipitQuotaError extends Error {
  constructor(message = 'Origin Private File System quota exceeded') {
    super(message);
    this.name = 'ZipitQuotaError';
  }
}

interface SyncAccessHandle {
  write(buffer: BufferSource, options?: { at?: number }): number;
  flush(): void;
  close(): void;
}

interface SyncFileHandle {
  createSyncAccessHandle(): Promise<SyncAccessHandle>;
}

/** Minimal backend interface used by OpfsStore and tests. */
export interface OpfsBackend {
  write(path: string, offset: number, data: Uint8Array): Promise<void>;
  read(path: string): Promise<ReadableStream<Uint8Array>>;
  size(path: string): Promise<number>;
  delete(path: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/** In-memory OPFS-compatible backend for unit tests. */
export class InMemoryOpfsBackend implements OpfsBackend {
  private readonly files = new Map<string, Uint8Array>();

  /** Writes bytes into an in-memory partial file. */
  async write(path: string, offset: number, data: Uint8Array): Promise<void> {
    const existing = this.files.get(path) ?? new Uint8Array(0);
    const next = new Uint8Array(Math.max(existing.byteLength, offset + data.byteLength));
    next.set(existing);
    next.set(data, offset);
    this.files.set(path, next);
  }

  /** Reads an in-memory partial file as a stream. */
  async read(path: string): Promise<ReadableStream<Uint8Array>> {
    const data = this.files.get(path) ?? new Uint8Array(0);
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  /** Returns the current in-memory file size. */
  async size(path: string): Promise<number> {
    return this.files.get(path)?.byteLength ?? 0;
  }

  /** Deletes an in-memory partial file. */
  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  /** Deletes every in-memory file beneath a path prefix. */
  async deletePrefix(prefix: string): Promise<void> {
    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        this.files.delete(path);
      }
    }
  }

  /** Checks whether an in-memory partial file exists. */
  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

class BrowserOpfsBackend implements OpfsBackend {
  async write(path: string, offset: number, data: Uint8Array): Promise<void> {
    const fileHandle = await this.getFileHandle(path, true);
    const syncHandle = await (fileHandle as FileSystemFileHandle & SyncFileHandle)
      .createSyncAccessHandle();
    try {
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      syncHandle.write(copy, { at: offset });
      syncHandle.flush();
    } catch (error) {
      throw normalizeOpfsError(error);
    } finally {
      syncHandle.close();
    }
  }

  async read(path: string): Promise<ReadableStream<Uint8Array>> {
    const file = await (await this.getFileHandle(path, false)).getFile();
    return file.stream();
  }

  async size(path: string): Promise<number> {
    try {
      return (await (await this.getFileHandle(path, false)).getFile()).size;
    } catch (error) {
      if (isNotFoundError(error)) return 0;
      throw error;
    }
  }

  async delete(path: string): Promise<void> {
    const { directory, name } = await this.resolveParent(path, false);
    await directory.removeEntry(name);
  }

  async deletePrefix(prefix: string): Promise<void> {
    const normalized = trimSlashes(prefix);
    const root = await navigator.storage.getDirectory();
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) return;

    const name = parts.pop();
    let directory = root;
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part);
    }
    if (name) {
      await directory.removeEntry(name, { recursive: true });
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.getFileHandle(path, false);
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  private async getFileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    const { directory, name } = await this.resolveParent(path, create);
    return directory.getFileHandle(name, { create });
  }

  private async resolveParent(
    path: string,
    create: boolean
  ): Promise<{ directory: FileSystemDirectoryHandle; name: string }> {
    const parts = trimSlashes(path).split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) {
      throw new Error('OPFS file path must include a filename');
    }

    let directory = await navigator.storage.getDirectory();
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create });
    }

    return { directory, name };
  }
}

/** OPFS-backed partial download storage for one ZipIt session. */
export default class OpfsStore {
  private constructor(
    readonly sessionId: string,
    private readonly backend: OpfsBackend = new BrowserOpfsBackend()
  ) {}

  /**
   * Opens or creates the OPFS directory for a session.
   *
   * @param sessionId - Session id used in `/zipit/{sessionId}`.
   * @returns A store scoped to the session.
   */
  static async open(sessionId: string): Promise<OpfsStore> {
    if (OpfsStore.canUseOpfs()) {
      return new OpfsStore(sessionId, new BrowserOpfsBackend());
    }
    console.warn('[ZipIt] OPFS not supported, falling back to in-memory storage. Downloads will not survive page refresh.');
    return new OpfsStore(sessionId, new InMemoryOpfsBackend());
  }

  /**
   * Creates a store backed by a caller-provided backend, primarily for tests.
   *
   * @param sessionId - Session id used in `/zipit/{sessionId}`.
   * @param backend - Backend implementation.
   * @returns A store scoped to the session.
   */
  static fromBackend(sessionId: string, backend: OpfsBackend): OpfsStore {
    return new OpfsStore(sessionId, backend);
  }

  /**
   * Checks whether browser OPFS directory access is available.
   *
   * @returns True when OPFS APIs are present.
   */
  static canUseOpfs(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage !== 'undefined' &&
      typeof navigator.storage.getDirectory === 'function'
    );
  }

  /**
   * Writes a chunk at an absolute offset in a `.partial` file.
   *
   * This uses FileSystemSyncAccessHandle in the browser backend and therefore
   * must be called from a worker context when running against real OPFS.
   *
   * @param fileId - File id whose partial file should be written.
   * @param offset - Absolute byte offset to write at.
   * @param data - Bytes to write.
   */
  async writeChunk(fileId: string, offset: number, data: Uint8Array): Promise<void> {
    try {
      await this.backend.write(this.filePath(fileId), offset, data);
    } catch (error) {
      throw normalizeOpfsError(error);
    }
  }

  /**
   * Reads the full `.partial` file as a stream.
   *
   * @param fileId - File id whose bytes should be read.
   * @returns A readable stream of the partial file.
   */
  async readFile(fileId: string): Promise<ReadableStream<Uint8Array>> {
    return this.backend.read(this.filePath(fileId));
  }

  /**
   * Gets the number of bytes currently staged for a file.
   *
   * @param fileId - File id whose partial size should be returned.
   * @returns Current `.partial` file size.
   */
  async getDownloadedBytes(fileId: string): Promise<number> {
    return this.backend.size(this.filePath(fileId));
  }

  /**
   * Deletes a single partial file.
   *
   * @param fileId - File id whose partial file should be removed.
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.backend.delete(this.filePath(fileId));
  }

  /**
   * Deletes all partial files for a session.
   *
   * @param sessionId - Session directory to remove from `/zipit`.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.backend.deletePrefix(`zipit/${sessionId}`);
  }

  /**
   * Checks whether a partial file exists.
   *
   * @param fileId - File id to check.
   * @returns True when the `.partial` file exists.
   */
  async exists(fileId: string): Promise<boolean> {
    return this.backend.exists(this.filePath(fileId));
  }

  private filePath(fileId: string): string {
    return `zipit/${this.sessionId}/${fileId}.partial`;
  }
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

function normalizeOpfsError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return new ZipitQuotaError(error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}
