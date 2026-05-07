import React from 'react';
import { useZipItContext } from './ZipItProvider';

export interface PauseResumeButtonProps {
  children: (props: { 
    onClick: () => void; 
    disabled: boolean; 
    isPaused: boolean 
  }) => React.ReactNode;
}

/**
 * ZipIt.PauseResumeButton — toggles between pause and resume states.
 */
export const PauseResumeButton: React.FC<PauseResumeButtonProps> = ({ children }) => {
  const { pause, resume, status } = useZipItContext();

  const isPaused = status === 'paused';
  const disabled = status !== 'running' && status !== 'paused';

  const onClick = isPaused ? resume : pause;

  return <>{children({ onClick, disabled, isPaused })}</>;
};
