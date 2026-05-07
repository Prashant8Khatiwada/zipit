import React from 'react';
import { useZipItContext } from './ZipItProvider';
import type { SessionState } from '@khatiwadaprashant/zipit-core';

export interface StartButtonProps {
  children: (props: { 
    onClick: () => void; 
    disabled: boolean; 
    status: SessionState['status'] 
  }) => React.ReactNode;
}

/**
 * ZipIt.StartButton — triggers the download/zip process.
 */
export const StartButton: React.FC<StartButtonProps> = ({ children }) => {
  const { start, status, files } = useZipItContext();

  const disabled = status === 'running' || files.size === 0;

  return <>{children({ onClick: start, disabled, status })}</>;
};
