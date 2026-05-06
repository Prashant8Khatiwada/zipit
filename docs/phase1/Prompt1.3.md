In packages/core/src/workers/download.worker.ts, implement the Web Worker that handles chunked HTTP downloads with resume support.

The worker receives messages of type DownloadWorkerInbound (from our types.ts) and posts DownloadWorkerOutbound messages.

Implement:

StartChunk handler:
  Input: { type: 'StartChunk', fileId, url, startByte, endByte, sessionId }
  
  1. Make a fetch() with Range header: `bytes={startByte}-{endByte}`
  2. Stream the response body using response.body.getReader()
  3. For every chunk received:
     a. Write to OPFS via OpfsStore.writeChunk (sync handle, Worker context)
     b. Post a ChunkProgress message: { type: 'ChunkProgress', fileId, bytesReceived, totalChunkBytes }
  4. On completion, post ChunkDone: { type: 'ChunkDone', fileId, startByte, endByte }
  5. On error (network, HTTP error, abort), post ChunkError: { type: 'ChunkError', fileId, error: string, retryable: boolean }
     - retryable = true for network errors, 5xx, 429
     - retryable = false for 403, 404, 416

AbortDownload handler:
  Input: { type: 'AbortDownload', fileId }
  Call AbortController.abort() for the in-flight fetch for that fileId.
  Post ChunkError with retryable: false and error: 'aborted'.

Requirements:
- Support multiple concurrent downloads in the same worker instance (Map of AbortControllers)
- No DOM access (worker context only)
- Proper TypeScript — typed self.onmessage and self.postMessage
- Export nothing (worker entry point)
- Handle the case where Range requests are not supported (server returns 200 instead of 206) — track offset manually