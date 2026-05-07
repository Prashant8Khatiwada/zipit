/**
 * Shared TypeScript types and interfaces for ZipIt.
 */

/** Describes a file to be downloaded */
export interface FileDescriptor {
  /** Stable UUID, deterministic from URL+path */
  id: string;
  url: string;
  /** Zip-relative path, e.g. "folder/file.txt" */
  path: string;
  /** Total size in bytes (undefined if unknown) */
  sizeBytes?: number;
  mimeType?: string;
  /** Arbitrary user-supplied metadata */
  metadata?: Record<string, unknown>;
}

/** The complete lifecycle of a file in the ZipIt queue. */
export type FilePhase =
  | 'pending'
  | 'downloading'
  | 'staging'
  | 'zipping'
  | 'done'
  | 'error';

/** Current progress state for an individual file. */
export interface FileProgress {
  fileId: string;
  phase: FilePhase;
  downloadedBytes: number;
  totalBytes?: number;
  error?: Error;
}

/** Describes the state of a download session for persistence. */
export interface SessionState {
  sessionId: string;
  files: FileDescriptor[];
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  /** Epoch ms */
  createdAt: number;
}

/** Aggregated progress stats for the entire session. */
export interface GlobalProgress {
  totalFiles: number;
  completedFiles: number;
  totalBytes?: number;
  downloadedBytes: number;
  speedBytesPerSecond: number;
  etaSeconds?: number;
  phase: 'downloading' | 'zipping' | 'done';
}

/** Configuration options for the ZipIt engine. */
export interface ZipitConfig {
  /** @default 3 */
  concurrency: number;
  /** @default 4MB */
  chunkSizeBytes: number;
  /** fflate compression levels (0=none, 1=fast, 6=balanced, 9=best) */
  compressionLevel: 0 | 1 | 6 | 9;
  /** @default 3 */
  retryAttempts: number;
  /** @default 1000 */
  retryDelayMs: number;
}

// ─── Worker message types ──────────────────────────────────────────────────

// Download Worker
export type DownloadWorkerInbound =
  | {
      type: 'StartChunk';
      fileId: string;
      url: string;
      startByte: number;
      endByte?: number;
      sessionId: string;
    }
  | { type: 'AbortDownload'; fileId: string };

export type DownloadWorkerOutbound =
  | {
      type: 'ChunkProgress';
      fileId: string;
      bytesReceived: number;
      totalChunkBytes: number | undefined;
    }
  | {
      type: 'ChunkDone';
      fileId: string;
      startByte: number;
      endByte: number | undefined;
    }
  | { type: 'ChunkError'; fileId: string; error: string; retryable: boolean };

// Zip Worker
export type ZipWorkerInbound =
  | { type: 'Init'; writerPort: MessagePort; compressionLevel: 0 | 1 | 6 | 9 }
  | { type: 'AddFile'; fileId: string; path: string; size: number; opfsPort: MessagePort }
  | { type: 'Finalize' }
  | { type: 'ADD_FILE'; id: string; path: string; size?: number }
  | { type: 'FINALIZE' };

export type ZipWorkerOutbound =
  | {
      type: 'FileZipped';
      fileId: string;
    }
  | {
      type: 'ZipProgress';
      compressedBytes: number;
      totalBytes: number;
    }
  | {
      type: 'ZipDone';
      finalSizeBytes: number;
    }
  | {
      type: 'ZipError';
      error: string;
    }
  | { type: 'ZIP_PROGRESS'; progress: number }
  | { type: 'ZIP_DONE'; blob: Blob }
  | { type: 'ZIP_ERROR'; message: string };

// ─── Public API Surface ──────────────────────────────────────────────────

/** Called periodically as download progresses. */
export type ProgressHandler = (stats: GlobalProgress) => void;

/** Called when any file encounters an error. */
export type ErrorHandler = (error: Error, fileId: string) => void;

/** Options for adding an individual file. */
export interface AddFileOptions {
  filename?: string;
  folder?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
}

/** The main ZipIt instance interface. */
export interface ZipItInstance {
  add: (url: string, options?: AddFileOptions) => FileDescriptor;
  addAll: (urls: string[], options?: AddFileOptions) => FileDescriptor[];
  start: (options?: { saveToFolder?: boolean }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  zip: (outputFilename?: string) => Promise<void>;
  saveToFolder: () => Promise<void>;
  on: (event: string, handler: any) => () => void;
  off: (event: string, handler: any) => void;
  getFiles: () => FileDescriptor[];
  getProgress: () => GlobalProgress;
  isPaused: () => boolean;
  isBusy: () => boolean;
  reset: () => Promise<void>;
  hydrate: () => Promise<FileDescriptor[]>;
}
