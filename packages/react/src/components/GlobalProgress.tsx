import React from 'react';
import { useZipItContext } from './ZipItProvider';
import type { GlobalProgress as GlobalProgressType } from '@khatiwadaprashant/zipit-core';

export interface GlobalProgressProps {
  children: (props: GlobalProgressType & { percent: number; speedMBps: number }) => React.ReactNode;
}

/**
 * ZipIt.GlobalProgress — provides aggregated session progress.
 */
export const GlobalProgress: React.FC<GlobalProgressProps> = ({ children }) => {
  const { globalProgress } = useZipItContext();

  if (!globalProgress) return null;

  const percent = globalProgress.totalBytes 
    ? (globalProgress.downloadedBytes / globalProgress.totalBytes) * 100 
    : 0;
  
  const speedMBps = globalProgress.speedBytesPerSecond / (1024 * 1024);

  return <>{children({ ...globalProgress, percent, speedMBps })}</>;
};
