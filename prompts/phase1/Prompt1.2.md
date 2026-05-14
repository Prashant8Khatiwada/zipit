In packages/core/src/storage/OpfsStore.ts, implement a class OpfsStore for storing partial download data using the Origin Private File System API.

The OPFS layout should be:
  /zipit/{sessionId}/{fileId}.partial   — raw bytes of downloaded chunks

Implement:

1. static open(sessionId: string): Promise<OpfsStore>
   Gets or creates the session directory inside /zipit/.

2. writeChunk(fileId: string, offset: number, data: Uint8Array): Promise<void>
   Writes `data` at `offset` in the .partial file using FileSystemSyncAccessHandle.
   This method must be callable from inside a Web Worker (OPFS sync API requires a worker context).

3. readFile(fileId: string): Promise<ReadableStream<Uint8Array>>
   Returns the full partial file as a ReadableStream (for feeding into ZIP worker).

4. getDownloadedBytes(fileId: string): Promise<number>
   Returns the current size of the .partial file (to resume from this offset).

5. deleteFile(fileId: string): Promise<void>

6. deleteSession(sessionId: string): Promise<void>
   Removes the entire /zipit/{sessionId}/ directory.

7. exists(fileId: string): Promise<boolean>

Requirements:
- Clearly separate which methods need Worker context (sync handle) vs. main thread (async handle)
- Add a static canUseOpfs(): boolean check
- TypeScript strict — no `any`
- Full JSDoc
- Include error handling for quota exceeded (DOMException: QuotaExceededError) — throw a typed ZipitQuotaError

Include Vitest tests using a mock OPFS (you can use a Map<string, Uint8Array> in-memory mock — define the mock interface too).