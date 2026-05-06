In packages/core/src/ZipPipeline.ts, integrate the ZIP worker and FileSystemWriter into a single pipeline class.

Class: ZipPipeline

Constructor: (config: Pick<ZipitConfig, 'compressionLevel'>, opfsStore: OpfsStore)

Methods:

1. async prepare(suggestedZipName: string): Promise<void>
   - Calls FileSystemWriter.requestSaveFile() (or fallback)
   - Spawns the zip.worker.ts
   - Sends 'Init' message to worker with a MessageChannel port connected to the writer

2. async addFile(file: FileDescriptor): Promise<void>
   - Creates a MessageChannel for OPFS data streaming
   - Sends 'AddFile' to the worker
   - On the main-thread side of the channel: reads from opfsStore.readFile() and posts chunks to the worker
   - Awaits 'FileZipped' response before resolving

3. async finalize(): Promise<{ finalSizeBytes: number }>
   - Sends 'Finalize' to worker
   - Awaits 'ZipDone'
   - Calls fileSystemWriter.close()
   - Returns final size

4. onProgress(callback: (p: { compressedBytes: number; totalBytes: number }) => void): () => void

5. abort(): Promise<void>

Requirements:
- addFile() calls should be serialized (one at a time) unless concurrency > 1 is explicitly set
- TypeScript strict
- Wire up backpressure: FileSystemWriter drain signals must pause the MessageChannel read loop