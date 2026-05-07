/**
 * @khatiwadaprashant/zipit-react — React hooks
 *
 * @example
 * import { useZipIt } from '@khatiwadaprashant/zipit-react';
 *
 * const { files, progress, start, pause, zip } = useZipIt({ concurrency: 4 });
 */

export { useZipIt } from './hooks/useZipIt';
export { useZip } from './hooks/useZip';
export { ZipIt, ZipItProvider, useZipItContext, ZipItUI, ZipItErrorBoundary } from './components';

export type { UseZipItResult } from './hooks/useZipIt';
export type { UseZipReturn } from './hooks/useZip';
export type { ZipItProviderProps } from './components/ZipItProvider';
export type { DropZoneProps } from './components/DropZone';
export type { FileListProps } from './components/FileList';
export type { GlobalProgressProps } from './components/GlobalProgress';
export type { StartButtonProps } from './components/StartButton';
export type { PauseResumeButtonProps } from './components/PauseResumeButton';
export type { RecoveryBannerProps } from './components/RecoveryBanner';
