In packages/core/src/workers/zip.worker.ts, implement the ZIP streaming Web Worker using fflate.

The worker:
- Receives files one-by-one from OPFS
- Compresses them using fflate's streaming Zip API
- Writes compressed output directly to a FileSystemWritableFileStream (File System Access API)

Message types:

Inbound:
  - { type: 'Init', writerPort: MessagePort, compressionLevel: number }
    The writerPort is a MessageChannel port connected to the main thread's file handle writer.
  - { type: 'AddFile', fileId: string, path: string, size: number, opfsPort: MessagePort }
    opfsPort provides a ReadableStream-like interface to the .partial file data.
  - { type: 'Finalize' }

Outbound:
  - { type: 'FileZipped', fileId: string }
  - { type: 'ZipProgress', compressedBytes: number, totalBytes: number }
  - { type: 'ZipDone', finalSizeBytes: number }
  - { type: 'ZipError', error: string }

Implementation:

1. On 'Init':
   - Import fflate dynamically
   - Create a fflate.Zip instance with ondata callback
   - ondata writes compressed bytes to writerPort via postMessage (transferable Uint8Array)

2. On 'AddFile':
   - Create a fflate.ZipDeflate for the file with the given compressionLevel
   - Read chunks from opfsPort
   - Feed each chunk into ZipDeflate.push(chunk, false)
   - After last chunk: ZipDeflate.push(new Uint8Array(0), true)
   - Post FileZipped when done
   - Update ZipProgress after each chunk

3. On 'Finalize':
   - Call zip.end()
   - Post ZipDone

Requirements:
- Use Transferable objects for all Uint8Array transfers (zero-copy)
- Handle backpressure: if writerPort signals the buffer is full (via a simple ACK protocol), pause reading from OPFS
- fflate must be bundled with the worker (not loaded from CDN)
- TypeScript strict