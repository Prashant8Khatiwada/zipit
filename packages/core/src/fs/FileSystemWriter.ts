/** File writer abstraction shared by the ZIP pipeline. */
export interface IFileSystemWriter {
  /** Writes a chunk and resolves when the writer can accept more data. */
  write(chunk: Uint8Array): Promise<void>;
  /** Flushes and finalizes the output file. */
  close(): Promise<void>;
  /** Aborts the write and releases any associated resources. */
  abort(reason?: string): Promise<void>;
  /** Returns the total number of bytes written so far. */
  getBytesWritten(): number;
}

type SaveFilePicker = (
  options: SaveFilePickerOptions
) => Promise<FileSystemFileHandle>;

interface SaveFilePickerOptions {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

const DEFAULT_BACKPRESSURE_BYTES = 32 * 1024 * 1024;

/** Native File System Access writer with threshold-based backpressure. */
export class FileSystemWriter implements IFileSystemWriter {
  private readonly thresholdBytes: number;
  private bytesWritten = 0;
  private inFlightBytes = 0;
  private drainWaiters: Array<() => void> = [];
  private closed = false;
  private aborted = false;

  private constructor(
    private readonly stream: FileSystemWritableFileStream,
    thresholdBytes = DEFAULT_BACKPRESSURE_BYTES
  ) {
    this.thresholdBytes = thresholdBytes;
  }

  /**
   * Requests a native save-file destination or falls back when unsupported.
   *
   * @param suggestedName - Name shown in the save dialog.
   * @returns A connected writer instance.
   */
  static async requestSaveFile(suggestedName: string): Promise<IFileSystemWriter> {
    if (FileSystemWriter.isSupported()) {
      const handle = await (window as unknown as Window & {
        showSaveFilePicker: SaveFilePicker;
      }).showSaveFilePicker({
        suggestedName,
        types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
      });
      return new FileSystemWriter(await handle.createWritable());
    }

    return new BlobFileSystemWriter(suggestedName);
  }

  /**
   * Returns whether native save-file support is available.
   *
   * @returns True when `showSaveFilePicker` exists.
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  /**
   * Writes bytes to the native writable stream.
   *
   * @param chunk - ZIP bytes to write.
   */
  async write(chunk: Uint8Array): Promise<void> {
    this.assertWritable();
    await this.waitForDrain(chunk.byteLength);

    this.inFlightBytes += chunk.byteLength;
    try {
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      await this.stream.write(copy as Uint8Array<ArrayBuffer>);
      this.bytesWritten += chunk.byteLength;
    } finally {
      this.inFlightBytes -= chunk.byteLength;
      this.releaseDrainWaiters();
    }
  }

  /** Closes the writable stream and flushes to disk. */
  async close(): Promise<void> {
    this.assertWritable();
    this.closed = true;
    await this.stream.close();
  }

  /** Aborts the write and releases the writable stream. */
  async abort(reason?: string): Promise<void> {
    if (this.aborted) return;
    this.aborted = true;
    await this.stream.abort(reason);
  }

  /** Returns the number of bytes accepted by the writer. */
  getBytesWritten(): number {
    return this.bytesWritten;
  }

  private async waitForDrain(nextBytes: number): Promise<void> {
    if (this.inFlightBytes === 0 || this.inFlightBytes + nextBytes <= this.thresholdBytes) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.drainWaiters.push(resolve);
    });
  }

  private releaseDrainWaiters(): void {
    if (this.inFlightBytes >= this.thresholdBytes) {
      return;
    }
    const waiters = this.drainWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  private assertWritable(): void {
    if (this.closed) {
      throw new Error('FileSystemWriter is closed');
    }
    if (this.aborted) {
      throw new Error('FileSystemWriter is aborted');
    }
  }
}

/** Blob-backed fallback writer for browsers without save-file support. */
export class BlobFileSystemWriter implements IFileSystemWriter {
  private readonly chunks: Uint8Array[] = [];
  private bytesWritten = 0;
  private closed = false;
  private aborted = false;
  private downloadUrl: string | null = null;

  constructor(private readonly suggestedName: string) {}

  /** Writes bytes into an in-memory blob accumulator. */
  async write(chunk: Uint8Array): Promise<void> {
    this.assertWritable();
    const copy = new Uint8Array(chunk.byteLength);
    copy.set(chunk);
    this.chunks.push(copy);
    this.bytesWritten += chunk.byteLength;
  }

  /** Creates a blob URL and triggers a download. */
  async close(): Promise<void> {
    this.assertWritable();
    this.closed = true;

    const blob = new Blob(this.chunks.map((chunk) => chunk.buffer as ArrayBuffer), {
      type: 'application/zip',
    });
    this.downloadUrl = URL.createObjectURL(blob);

    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.href = this.downloadUrl;
      anchor.download = this.suggestedName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  /** Aborts the download and revokes any generated URL. */
  async abort(): Promise<void> {
    if (this.aborted) return;
    this.aborted = true;
    if (this.downloadUrl) {
      URL.revokeObjectURL(this.downloadUrl);
      this.downloadUrl = null;
    }
    this.chunks.length = 0;
  }

  /** Returns the number of bytes buffered so far. */
  getBytesWritten(): number {
    return this.bytesWritten;
  }

  private assertWritable(): void {
    if (this.closed) {
      throw new Error('FileSystemWriter is closed');
    }
    if (this.aborted) {
      throw new Error('FileSystemWriter is aborted');
    }
  }
}

export default FileSystemWriter;
