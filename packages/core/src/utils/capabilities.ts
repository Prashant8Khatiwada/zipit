/**
 * Browser capability detection utilities.
 * Use these to gracefully degrade when advanced APIs are unavailable.
 *
 * @example
 * const caps = getBrowserCapabilities();
 * if (!caps.opfs) console.warn('OPFS not available — using in-memory fallback');
 */

export interface BrowserCapabilities {
  /** Origin Private File System — high-performance OPFS staging. */
  opfs: boolean;
  /** File System Access API — native folder save dialog. */
  fileSystemAccess: boolean;
  /** Web Workers support (required for concurrent downloads). */
  workers: boolean;
  /** Service Workers (required for streamsaver fallback). */
  serviceWorkers: boolean;
  /** ReadableStream with getReader() support. */
  streams: boolean;
}

/** @returns true if this browser supports OPFS SyncAccessHandle */
export function supportsOPFS(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

/** @returns true if this browser supports the File System Access API (showDirectoryPicker) */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** @returns true if the browser supports Web Workers */
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined';
}

/** @returns true if the browser supports Service Workers */
export function supportsServiceWorkers(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/** @returns true if the browser supports WHATWG Streams */
export function supportsStreams(): boolean {
  return (
    typeof ReadableStream !== 'undefined' &&
    typeof ReadableStream.prototype.getReader === 'function'
  );
}

/**
 * Get a full snapshot of browser capabilities relevant to ZipIt.
 *
 * @example
 * const caps = getBrowserCapabilities();
 * // { opfs: true, fileSystemAccess: true, workers: true, ... }
 */
export function getBrowserCapabilities(): BrowserCapabilities {
  return {
    opfs: supportsOPFS(),
    fileSystemAccess: supportsFileSystemAccess(),
    workers: supportsWorkers(),
    serviceWorkers: supportsServiceWorkers(),
    streams: supportsStreams(),
  };
}
