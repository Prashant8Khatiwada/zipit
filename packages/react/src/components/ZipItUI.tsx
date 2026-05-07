import React from 'react';
import { ZipItProvider } from './ZipItProvider';
import { DropZone } from './DropZone';
import { FileList } from './FileList';
import { GlobalProgress } from './GlobalProgress';
import { StartButton } from './StartButton';
import { PauseResumeButton } from './PauseResumeButton';
import { RecoveryBanner } from './RecoveryBanner';
import type { ZipitConfig } from '@khatiwadaprashant/zipit-core';
import type { UseZipItResult } from '../hooks/useZipIt';
import styles from './ZipItUI.module.css';

export interface ZipItUIProps {
  config?: Partial<ZipitConfig>;
  className?: string;
  zipName?: string;
  /** Optional external state to use instead of creating a new instance */
  value?: UseZipItResult;
}

/**
 * ZipItUI — a fully-styled, production-ready default UI component.
 */
export const ZipItUI: React.FC<ZipItUIProps> = ({ config, className = '', zipName = 'archive.zip', value }) => {
  const content = (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>ZipIt: {zipName}</h3>
      </div>
      
      {/* Recovery Banner */}
      <RecoveryBanner>
        {({ sessionIds, onRecover }) => (
          <div className={styles.recoveryBanner}>
            <span>Interrupted session found ({sessionIds.length})</span>
            <button 
              className={styles.recoverBtn}
              onClick={() => onRecover(sessionIds[0])}
            >
              Recover
            </button>
          </div>
        )}
      </RecoveryBanner>

      {/* Global Progress */}
      <GlobalProgress>
        {({ percent, speedMBps, phase, etaSeconds, completedFiles, totalFiles }) => (
          <div className={styles.globalProgress}>
            <div className={styles.progressHeader}>
              <div className={`${styles.percent} ${styles.mono}`}>
                {Math.round(percent)}%
              </div>
              <div className={styles.stats}>
                <span className={`${styles.pill} ${styles.mono}`}>
                  {speedMBps.toFixed(1)} MB/s
                </span>
                {etaSeconds !== undefined && (
                  <span className={`${styles.pill} ${styles.mono}`}>
                    ETA: {Math.round(etaSeconds)}s
                  </span>
                )}
                <span className={styles.pill}>
                  {completedFiles} / {totalFiles}
                </span>
              </div>
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBar} 
                style={{ width: `${percent}%` }}
              />
              {phase === 'downloading' && <div className={styles.shimmer} />}
            </div>
          </div>
        )}
      </GlobalProgress>

      {/* Drop Zone */}
      <DropZone onFiles={(files) => console.log('Dropped:', files)}>
        {({ isDragging }) => (
          <div className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}>
            <p>{isDragging ? 'Drop to start' : 'Drag & drop URLs or files here'}</p>
            <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '8px' }}>
              They will be zipped on-the-fly in your browser
            </p>
          </div>
        )}
      </DropZone>

      {/* File List */}
      <FileList>
        {(files) => (
          <div className={styles.fileList}>
            {files.map((file) => (
              <div key={file.fileId} className={styles.fileItem}>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{file.fileId}</span>
                  <span className={`${styles.phase} ${styles[`phase-${file.phase}`]}`}>
                    {file.phase}
                  </span>
                </div>
                <div className={styles.fileProgressBar}>
                  <div 
                    className={`${styles.fileProgressFill} ${styles[`phase-${file.phase}`]}`}
                    style={{ 
                      width: file.totalBytes 
                        ? `${(file.downloadedBytes / file.totalBytes) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </FileList>

      {/* Action Buttons */}
      <div className={styles.actions}>
        <StartButton>
          {({ onClick, disabled, status }) => (
            <button 
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onClick}
              disabled={disabled}
            >
              {status === 'done' ? 'Completed' : 'Start Download'}
            </button>
          )}
        </StartButton>
        
        <PauseResumeButton>
          {({ onClick, disabled, isPaused }) => (
            <button 
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={onClick}
              disabled={disabled}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
        </PauseResumeButton>
      </div>
    </div>
  );

  // If value is provided, assume we are already inside a Provider or we want to use this value.
  // Actually, ZipItProvider with 'value' prop handles this.
  return (
    <ZipItProvider config={config} value={value}>
      {content}
    </ZipItProvider>
  );
};
