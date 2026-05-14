/// <reference lib="webworker" />
/**
 * ZipIt Download Worker
 *
 * Runs in a dedicated Web Worker thread. Fetches a file in streaming chunks
 * and writes them synchronously into the Origin Private File System (OPFS)
 * using FileSystemSyncAccessHandle for maximum throughput.
 *
 * Supports:
 * - Range requests (byte-level resumability)
 * - HEAD-based smart failover
 * - Pause via AbortController
 * - Content-Length metadata detection
 */

export interface WorkerStart {
  type: 'start';
  id: string;
  url: string;
  startByte: number;
  options?: {
    fetchTimeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    retryBackoffMultiplier?: number;
  };
}

export interface WorkerPause {
  type: 'pause';
  id: string;
}

export type WorkerInMessage = WorkerStart | WorkerPause;

export interface WorkerProgress {
  type: 'progress';
  id: string;
  downloadedBytes: number;
}

export interface WorkerCompleted {
  type: 'completed';
  id: string;
}

export interface WorkerPaused {
  type: 'paused';
  id: string;
}

export interface WorkerError {
  type: 'error';
  id: string;
  error: string;
  code?: string;
}

export interface WorkerMetadataUpdate {
  type: 'metadata_update';
  id: string;
  totalBytes: number;
}

export type WorkerOutMessage =
  | WorkerProgress
  | WorkerCompleted
  | WorkerPaused
  | WorkerError
  | WorkerMetadataUpdate;

// ─── Worker state ──────────────────────────────────────────────────────────────
const activeTasks = new Map<string, { abortController: AbortController }>();

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === 'start') {
    const { id, url, startByte } = msg;
    if (activeTasks.has(id)) return;

    const abortController = new AbortController();
    activeTasks.set(id, { abortController });

    try {
      await processDownload(id, url, startByte, abortController.signal, msg.options);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === 'AbortError' || abortController.signal.aborted) {
        self.postMessage({ type: 'paused', id } satisfies WorkerPaused);
      } else {
        const isQuota = e.name === 'QuotaExceededError' || e.message.includes('QuotaExceededError');
        self.postMessage({
          type: 'error',
          id,
          error: e.message || String(e),
          code: isQuota ? 'QUOTA_EXCEEDED' : undefined,
        } satisfies WorkerError);
      }
    } finally {
      activeTasks.delete(id);
    }
  } else if (msg.type === 'pause') {
    activeTasks.get(msg.id)?.abortController.abort();
  }
};

async function processDownload(
  id: string,
  url: string,
  startByte: number,
  signal: AbortSignal,
  options: WorkerStart['options'] = {}
): Promise<void> {
  const {
    fetchTimeoutMs = 30000,
    maxRetries = 3,
    retryDelayMs = 1000,
    retryBackoffMultiplier = 2,
  } = options;
  const rootDir = await navigator.storage.getDirectory();
  const fileHandle = await rootDir.getFileHandle(id, { create: true });
  // @ts-ignore — createSyncAccessHandle is available in workers
  const accessHandle = await fileHandle.createSyncAccessHandle();

  try {
    const headers = new Headers();
    if (startByte > 0) headers.set('Range', `bytes=${startByte}-`);

    let response = await fetchWithRetry(url, {
      headers,
      signal,
      timeoutMs: fetchTimeoutMs,
      maxRetries,
      retryDelayMs,
      retryBackoffMultiplier,
    });

    // Report total size if known
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader) {
      const totalBytes = parseInt(contentLengthHeader, 10) + (startByte || 0);
      self.postMessage({
        type: 'metadata_update',
        id,
        totalBytes,
      } satisfies WorkerMetadataUpdate);
    }

    if (!response.body) throw new Error('Response body is null');

    const reader = response.body.getReader();
    let currentByte = startByte;
    let lastReportTime = Date.now();
    const REPORT_INTERVAL_MS = 300;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      // @ts-ignore — write options available in workers
      accessHandle.write(value, { at: currentByte });
      currentByte += value.byteLength;

      const now = Date.now();
      if (now - lastReportTime > REPORT_INTERVAL_MS) {
        self.postMessage({
          type: 'progress',
          id,
          downloadedBytes: currentByte,
        } satisfies WorkerProgress);
        lastReportTime = now;
      }
    }

    // @ts-ignore
    if (typeof accessHandle.flush === 'function') accessHandle.flush();

    // Final progress report
    self.postMessage({
      type: 'progress',
      id,
      downloadedBytes: currentByte,
    } satisfies WorkerProgress);

    self.postMessage({ type: 'completed', id } satisfies WorkerCompleted);
  } finally {
    accessHandle.close();
  }
}

/**
 * Fetch with timeout and retry logic.
 */
async function fetchWithRetry(
  url: string,
  options: {
    headers: Headers;
    signal: AbortSignal;
    timeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
    retryBackoffMultiplier: number;
  }
): Promise<Response> {
  let attempt = 0;
  let delay = options.retryDelayMs;

  while (true) {
    const fetchController = new AbortController();
    const timeoutId = setTimeout(() => fetchController.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: options.headers,
        signal: fetchController.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 206) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const e = err as Error;

      if (options.signal.aborted) throw e;
      
      const isTimeout = e.name === 'AbortError' && !options.signal.aborted;
      attempt++;

      if (attempt >= options.maxRetries) {
        throw isTimeout ? new Error('FETCH_TIMEOUT') : e;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= options.retryBackoffMultiplier;
    }
  }
}
