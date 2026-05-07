/**
 * Browser compatibility detection and feature support layer.
 */

/**
 * Check if Origin Private File System (OPFS) is supported.
 */
export function supportsOpfs(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && 'getDirectory' in navigator.storage;
}

/**
 * Check if the File System Access API (specifically showDirectoryPicker/showSaveFilePicker) is supported.
 */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/**
 * Check if the browser supports multi-threaded Web Workers.
 */
export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined';
}

/**
 * Check if a URL supports Range requests (crucial for parallel downloading).
 * Makes a HEAD request to check for 'Accept-Ranges: bytes'.
 */
export async function supportsRangeRequests(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const acceptRanges = response.headers.get('Accept-Ranges');
    return acceptRanges === 'bytes';
  } catch (err) {
    console.warn(`[ZipIt] Could not check range support for ${url}:`, err);
    return false;
  }
}

/**
 * Determine the best storage strategy based on browser capabilities.
 */
export function getBestStorageStrategy(): 'opfs' | 'memory' | 'indexeddb-chunks' {
  if (supportsOpfs()) return 'opfs';
  // Future: implement indexeddb-chunks for medium-sized files on Safari/Old browsers
  return 'memory';
}
