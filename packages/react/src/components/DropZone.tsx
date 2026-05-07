import React, { useState, useCallback } from 'react';

export interface DropZoneProps {
  onFiles: (files: File[]) => void;
  children: (props: { isDragging: boolean }) => React.ReactNode;
}

/**
 * ZipIt.DropZone — a headless drag-and-drop handler.
 */
export const DropZone: React.FC<DropZoneProps> = ({ onFiles, children }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  }, [onFiles]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ display: 'contents' }}
    >
      {children({ isDragging })}
    </div>
  );
};
