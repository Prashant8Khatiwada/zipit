import { ZipItProvider } from './ZipItProvider';
import { DropZone } from './DropZone';
import { FileList } from './FileList';
import { GlobalProgress } from './GlobalProgress';
import { StartButton } from './StartButton';
import { PauseResumeButton } from './PauseResumeButton';
import { RecoveryBanner } from './RecoveryBanner';

/**
 * ZipIt — Headless UI components for the ZipIt library.
 */
export const ZipIt = {
  Provider: ZipItProvider,
  DropZone,
  FileList,
  GlobalProgress,
  StartButton,
  PauseResumeButton,
  RecoveryBanner,
};

export { ZipItProvider, useZipItContext } from './ZipItProvider';
export { DropZone } from './DropZone';
export { FileList } from './FileList';
export { GlobalProgress } from './GlobalProgress';
export { StartButton } from './StartButton';
export { PauseResumeButton } from './PauseResumeButton';
export { RecoveryBanner } from './RecoveryBanner';
export { ZipItUI } from './ZipItUI';
export { ZipItErrorBoundary } from './ZipItErrorBoundary';
