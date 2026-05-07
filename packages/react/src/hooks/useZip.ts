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

import { useCallback, useState } from 'react';
import { createZipIt } from '@khatiwadaprashant/zipit-core';
import type { GlobalProgress } from '@khatiwadaprashant/zipit-core';

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
}

export function useZip(): UseZipReturn {
  const [isZipping, setIsZipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const zip = useCallback(
    async (
      urls: string[],
      filename = 'archive.zip',
      folderMap?: Map<string, string>
    ) => {
      setIsZipping(true);
      setProgress(0);
      setError(null);

      let unsubscribe: (() => void) | undefined;
      try {
        const ds = createZipIt();
        unsubscribe = ds.on('progress', (stats: GlobalProgress) => {
          const byteProgress =
            stats.totalBytes && stats.totalBytes > 0
              ? stats.downloadedBytes / stats.totalBytes
              : 0;
          const fileProgress =
            stats.totalFiles > 0 ? stats.completedFiles / stats.totalFiles : 0;
          setProgress(Math.max(byteProgress, fileProgress));
        });

        urls.forEach((url) =>
          ds.add(url, {
            folder: folderMap?.get(url),
          })
        );

        await ds.zip(filename);
      } catch (err: unknown) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        unsubscribe?.();
        setIsZipping(false);
        setProgress(1);
      }
    },
    []
  );

  return { zip, isZipping, progress, error };
}
