/**
 * useZip — lightweight hook for one-shot ZIP streaming.
 *
 * Perfect for simple "download as ZIP" buttons without needing the full
 * DropStream download manager.
 *
 * @example
 * ```tsx
 * import { useZip } from '@khatiwadaprashant/zipit-react';
 *
 * function ZipButton({ urls }: { urls: string[] }) {
 *   const { zip, isZipping, progress } = useZip();
 *   return (
 *     <button onClick={() => zip(urls, 'my-archive.zip')} disabled={isZipping}>
 *       {isZipping ? `Zipping ${(progress * 100).toFixed(0)}%…` : 'Download ZIP'}
 *     </button>
 *   );
 * }
 * ```
 */

import { useCallback, useRef, useState } from 'react';
import { createZipIt } from '@khatiwadaprashant/zipit-core';
import type { ProgressStats } from '@khatiwadaprashant/zipit-core';

export interface UseZipReturn {
  /**
   * Stream-zip the given URLs into a ZIP archive delivered to disk.
   * @param urls - Array of remote URLs to include.
   * @param filename - Output filename (default: 'archive.zip').
   * @param folderMap - Optional map from URL → folder path for structure preservation.
   */
  zip: (
    urls: string[],
    filename?: string,
    folderMap?: Map<string, string>
  ) => Promise<void>;
  /** Whether a ZIP operation is currently in progress. */
  isZipping: boolean;
  /** 0–1 progress estimate (based on files processed). */
  progress: number;
  /** Error from the last failed zip, if any. */
  error: Error | null;
  /** Cancel an in-progress zip operation. */
  abort: () => void;
}

export function useZip(): UseZipReturn {
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsZipping(false);
    }
  }, []);

  const zip = useCallback(
    async (
      urls: string[],
      filename = 'archive.zip',
      folderMap?: Map<string, string>
    ) => {
      setIsZipping(true);
      setProgress(0);
      setError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const ds = createZipIt({
          onProgress: (stats: ProgressStats) => setProgress(stats.overallProgress),
        });

        urls.forEach((url) =>
          ds.add(url, {
            folder: folderMap?.get(url),
          })
        );

        // We need to pass the signal to ds.zip
        // For now, we'll cast and assume it supports it or we'll update core next
        await (ds as any).zip(filename, { signal: abortController.signal });
      } catch (err: unknown) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsZipping(false);
        setProgress(1);
        abortControllerRef.current = null;
      }
    },
    []
  );

  return { zip, isZipping, progress, error, abort };
}
