In packages/core/src/DownloadOrchestrator.ts, implement the main coordinator class that manages the worker pool and retry logic.

Class: DownloadOrchestrator

Constructor: (config: ZipitConfig, sessionStore: SessionStore, opfsStore: OpfsStore)

Public API:

1. enqueue(files: FileDescriptor[]): Promise<void>
   Adds files to the download queue. Checks OPFS for existing .partial files to compute startByte for resume.
   Calls SessionStore.saveFileProgress for each file with phase: 'pending'.

2. start(): void
   Begins processing the queue using a worker pool of size config.concurrency.
   Spawns DownloadWorker instances (up to concurrency limit).

3. pause(): void
   Sends AbortDownload to all active workers. Saves current byte offsets to IndexedDB.

4. resume(): void
   Reads IndexedDB for partial progress, reconstructs queue from remaining files, calls start().

5. onProgress(callback: (p: FileProgress) => void): () => void
   Registers a progress callback. Returns an unsubscribe function.

6. onFileComplete(callback: (fileId: string) => void): () => void

7. onError(callback: (fileId: string, err: Error) => void): () => void

Retry logic:
- On ChunkError with retryable: true, use exponential backoff: delay = config.retryDelayMs * 2^attempt
- After config.retryAttempts failures, emit onError and mark file as 'error' in IndexedDB

Internal:
- Use a simple queue + active set pattern
- When a worker finishes a file, dequeue the next one and assign it
- Emit onProgress for every ChunkProgress message from workers

Requirements:
- TypeScript strict
- No React dependency
- Full JSDoc