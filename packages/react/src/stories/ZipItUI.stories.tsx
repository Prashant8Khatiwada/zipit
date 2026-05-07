import { useState, useCallback } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ZipItUI } from '../components/ZipItUI';
import { ZipItProvider } from '../components/ZipItProvider';
import type { UseZipItResult } from '../hooks/useZipIt';
import type { FileProgress, GlobalProgress } from '@khatiwadaprashant/zipit-core';

const meta: Meta<typeof ZipItUI> = {
  title: 'Components/ZipItUI',
  component: ZipItUI,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ZipItUI>;

const MockSimulator = () => {
  const [status, setStatus] = useState<UseZipItResult['status']>('idle');
  const [files, setFiles] = useState<Map<string, FileProgress>>(new Map());
  const [globalProgress, setGlobalProgress] = useState<GlobalProgress | null>(null);

  const startSimulation = useCallback(() => {
    setStatus('running');
    
    const initialFiles = new Map<string, FileProgress>();
    ['vacation-1.jpg', 'vacation-2.jpg', 'sunset.mp4'].forEach(name => {
      initialFiles.set(name, {
        fileId: name,
        phase: 'pending',
        downloadedBytes: 0,
        totalBytes: name.endsWith('.mp4') ? 50 * 1024 * 1024 : 5 * 1024 * 1024,
      });
    });
    setFiles(initialFiles);

    let elapsed = 0;
    const duration = 10000; // 10 seconds
    const interval = 100; // update every 100ms

    const timer = setInterval(() => {
      elapsed += interval;
      const ratio = Math.min(elapsed / duration, 1);

      setFiles(prev => {
        const next = new Map(prev);
        Array.from(next.keys()).forEach((name, index) => {
          const file = next.get(name)!;
          // Stagger files
          const fileStart = index * 0.2;
          const fileEnd = (index + 1) * 0.33 + 0.33;
          const fileRatio = Math.max(0, Math.min((ratio - fileStart) / (fileEnd - fileStart), 1));
          
          let phase: FileProgress['phase'] = 'pending';
          if (fileRatio > 0 && fileRatio < 0.8) phase = 'downloading';
          else if (fileRatio >= 0.8 && fileRatio < 1) phase = 'zipping';
          else if (fileRatio === 1) phase = 'done';

          next.set(name, {
            ...file,
            phase,
            downloadedBytes: Math.floor(file.totalBytes! * fileRatio),
          });
        });
        return next;
      });

      const totalBytes = Array.from(initialFiles.values()).reduce((sum, f) => sum + f.totalBytes!, 0);
      const downloadedBytes = Math.floor(totalBytes * ratio);
      
      setGlobalProgress({
        totalFiles: 3,
        completedFiles: ratio === 1 ? 3 : Math.floor(ratio * 3),
        totalBytes,
        downloadedBytes,
        speedBytesPerSecond: 10 * 1024 * 1024, // Fixed 10MB/s for sim
        etaSeconds: Math.ceil((duration - elapsed) / 1000),
        phase: ratio < 0.9 ? 'downloading' : (ratio < 1 ? 'zipping' : 'done'),
      });

      if (ratio === 1) {
        clearInterval(timer);
        setStatus('done');
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const mockValue: UseZipItResult = {
    sessionId: 'sim-123',
    status,
    files,
    globalProgress,
    error: null,
    isRecoverable: false,
    isIdle: status === 'idle',
    isRunning: status === 'running',
    isDone: status === 'done',
    addFiles: () => {},
    start: async () => { startSimulation(); },
    pause: () => setStatus('paused'),
    resume: () => setStatus('running'),
    cancel: () => setStatus('idle'),
    recover: async () => {},
  };

  return (
    <ZipItProvider value={mockValue}>
      <ZipItUI />
    </ZipItProvider>
  );
};

export const SimulatedDownload: Story = {
  render: () => <MockSimulator />,
};

export const Idle: Story = {
  args: {},
};
