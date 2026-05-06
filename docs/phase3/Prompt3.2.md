In packages/core/src/fs/FileSystemWriter.ts, implement a class that manages the File System Access API for the output ZIP file.

Class: FileSystemWriter

Static:
  static async requestSaveFile(suggestedName: string): Promise<FileSystemWriter>
    Shows the native "Save File" dialog (window.showSaveFilePicker) with:
      - suggestedName
      - types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }]
    Returns a connected FileSystemWriter instance.
  
  static isSupported(): boolean
    Returns true if window.showSaveFilePicker exists.

Instance:
  async write(chunk: Uint8Array): Promise<void>
    Writes chunk to the FileSystemWritableFileStream.
    Implements backpressure: if the internal buffer exceeds a threshold (configurable, default 32MB),
    awaits a drain before accepting more data.

  async close(): Promise<void>
    Closes the writable stream and flushes to disk.

  async abort(reason?: string): Promise<void>
    Aborts the write and cleans up.

  getBytesWritten(): number

Also implement a fallback FileSystemWriter that uses a Blob accumulator + URL.createObjectURL download trick, for browsers that don't support showSaveFilePicker. Both classes must implement the same interface: IFileSystemWriter.

Requirements:
- The backpressure mechanism must communicate with the ZIP worker (return a signal/promise)
- TypeScript strict
- Full JSDoc on the public API