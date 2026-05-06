In packages/core/src/types.ts, define all shared TypeScript types and interfaces for zipit.

Include:

1. FileDescriptor — describes a file to be downloaded:
   - id: string (stable UUID, deterministic from URL+path)
   - url: string
   - path: string (zip-relative path, e.g. "folder/file.txt")
   - sizeBytes: number | undefined  (undefined if Content-Length is missing)
   - mimeType?: string

2. FilePhase — union type:
   'pending' | 'downloading' | 'staging' | 'zipping' | 'done' | 'error'

3. FileProgress:
   - fileId: string
   - phase: FilePhase
   - downloadedBytes: number
   - totalBytes: number | undefined
   - error?: Error

4. SessionState:
   - sessionId: string
   - files: FileDescriptor[]
   - status: 'idle' | 'running' | 'paused' | 'done' | 'error'
   - createdAt: number (epoch ms)

5. GlobalProgress:
   - totalFiles: number
   - completedFiles: number
   - totalBytes: number | undefined
   - downloadedBytes: number
   - speedBytesPerSecond: number
   - etaSeconds: number | undefined
   - phase: 'downloading' | 'zipping' | 'done'

6. ZipitConfig:
   - concurrency: number (default 3)
   - chunkSizeBytes: number (default 4MB)
   - compressionLevel: 0 | 1 | 6 | 9 (fflate levels)
   - retryAttempts: number (default 3)
   - retryDelayMs: number (default 1000)

7. Worker message types (discriminated unions):
   - DownloadWorkerInbound: StartChunk | AbortDownload
   - DownloadWorkerOutbound: ChunkProgress | ChunkDone | ChunkError
   - ZipWorkerInbound: AddFile | Finalize
   - ZipWorkerOutbound: ZipProgress | ZipDone | ZipError

Export all types. No implementation — types only.