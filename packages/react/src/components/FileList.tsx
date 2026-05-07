import React from 'react';
import { useZipItContext } from './ZipItProvider';
import type { FileProgress } from '@khatiwadaprashant/zipit-core';

export interface FileListProps {
  children: (files: FileProgress[]) => React.ReactNode;
}

/**
 * ZipIt.FileList — provides the current list of files and their progress.
 */
export const FileList: React.FC<FileListProps> = ({ children }) => {
  const { files } = useZipItContext();
  const fileArray = Array.from(files.values());

  return <>{children(fileArray)}</>;
};
