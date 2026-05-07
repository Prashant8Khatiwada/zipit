import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useZipIt } from '../useZipIt';
import * as core from '@khatiwadaprashant/zipit-core';

// Mock the core library
vi.mock('@khatiwadaprashant/zipit-core', async () => {
  const actual = await vi.importActual<typeof core>('@khatiwadaprashant/zipit-core');
  return {
    ...actual,
    createZipIt: vi.fn(),
    SessionStore: {
      open: vi.fn(),
    },
    SessionRecovery: vi.fn(),
  };
});

describe('useZipIt', () => {
  let mockInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock instance
    mockInstance = {
      on: vi.fn(() => vi.fn()), // returns unsubscribe fn
      add: vi.fn(),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      hydrate: vi.fn(),
    };
    
    (core.createZipIt as any).mockReturnValue(mockInstance);
    
    // Mock SessionStore
    (core.SessionStore.open as any).mockResolvedValue({
      listSessions: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    });
    
    // Mock SessionRecovery
    (core.SessionRecovery as any).mockImplementation(() => ({
      findInterruptedSessions: vi.fn().mockResolvedValue([]),
    }));
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useZipIt());
    
    expect(result.current.status).toBe('idle');
    expect(result.current.isIdle).toBe(true);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isDone).toBe(false);
    expect(result.current.files.size).toBe(0);
  });

  it('transitions to running state on start', async () => {
    const { result } = renderHook(() => useZipIt());
    
    await act(async () => {
      await result.current.start();
    });
    
    expect(result.current.status).toBe('running');
    expect(result.current.isRunning).toBe(true);
    expect(mockInstance.start).toHaveBeenCalledWith({ saveToFolder: true });
  });

  it('handles progress updates', async () => {
    let progressCallback: any;
    mockInstance.on.mockImplementation((event: string, cb: any) => {
      if (event === 'progress') progressCallback = cb;
      return vi.fn();
    });

    const { result } = renderHook(() => useZipIt());
    
    act(() => {
      progressCallback({
        phase: 'downloading',
        totalFiles: 1,
        completedFiles: 0,
        downloadedBytes: 100,
        totalBytes: 1000,
        speedBytesPerSecond: 10,
      });
    });

    expect(result.current.globalProgress).not.toBeNull();
    expect(result.current.globalProgress?.downloadedBytes).toBe(100);
  });

  it('updates file progress', () => {
    let fileProgressCallback: any;
    mockInstance.on.mockImplementation((event: string, cb: any) => {
      if (event === 'file-progress') fileProgressCallback = cb;
      return vi.fn();
    });

    const { result } = renderHook(() => useZipIt());
    
    act(() => {
      fileProgressCallback({
        fileId: 'file1',
        phase: 'downloading',
        downloadedBytes: 50,
        totalBytes: 100,
      });
    });

    expect(result.current.files.get('file1')).toEqual({
      fileId: 'file1',
      phase: 'downloading',
      downloadedBytes: 50,
      totalBytes: 100,
    });
  });

  it('handles pause and resume', async () => {
    const { result } = renderHook(() => useZipIt());
    
    act(() => {
      result.current.pause();
    });
    expect(result.current.status).toBe('paused');
    expect(mockInstance.pause).toHaveBeenCalled();

    act(() => {
      result.current.resume();
    });
    expect(result.current.status).toBe('running');
    expect(mockInstance.resume).toHaveBeenCalled();
  });
});
