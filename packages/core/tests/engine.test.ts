import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadEngine } from '../src/core/DownloadEngine';
import { StateStore } from '../src/store/StateStore';
import type { FileEntry, ZipItOptions } from '../src/types';

// Mock helpers
const createMockStore = () => ({
  getAll: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(undefined),
  upsert: vi.fn().mockResolvedValue(undefined),
  upsertAll: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  clearAll: vi.fn().mockResolvedValue(undefined),
} as unknown as StateStore);

const mockOptions: Required<ZipItOptions> = {
  concurrency: 3,
  zipBackpressureLimit: 10,
  streamBufferBytes: 5 * 1024 * 1024,
  dbName: 'test_db',
  onProgress: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
  onFileProgress: vi.fn(),
  onFileRemoved: vi.fn(),
  fetchTimeoutMs: 30000,
  maxRetriesPerFile: 3,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
  hydrateTimeoutMs: 5000,
  debug: false,
  allowedProtocols: ['https:', 'http:'],
};

describe('DownloadEngine', () => {
  let engine: DownloadEngine;
  let store: StateStore;

  beforeEach(() => {
    store = createMockStore();
    
    // Mock Worker
    global.Worker = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    // Mock navigator.storage
    Object.defineProperty(global.navigator, 'storage', {
      value: {
        getDirectory: vi.fn().mockResolvedValue({
          getFileHandle: vi.fn(),
          removeEntry: vi.fn(),
        }),
      },
      configurable: true,
    });

    engine = new DownloadEngine(mockOptions, store);
    vi.useFakeTimers();
  });

  it('should add a file and update total bytes', () => {
    const entry: FileEntry = {
      id: 'test-1',
      url: 'https://example.com/test.jpg',
      filename: 'test.jpg',
      totalBytes: 1000,
      downloadedBytes: 0,
      status: 'idle',
      addedAt: Date.now(),
      retryCount: 0,
    };

    engine.addFile(entry);

    const stats = engine.getProgress();
    expect(stats.totalFiles).toBe(1);
    expect(stats.totalBytes).toBe(1000);
    expect(store.upsert).toHaveBeenCalledWith(entry);
  });

  it('should calculate overall progress correctly', () => {
    const entry1: FileEntry = {
      id: 'test-1',
      url: 'https://example.com/1.jpg',
      filename: '1.jpg',
      totalBytes: 1000,
      downloadedBytes: 500,
      status: 'downloading',
      addedAt: Date.now(),
      retryCount: 0,
    };

    const entry2: FileEntry = {
      id: 'test-2',
      url: 'https://example.com/2.jpg',
      filename: '2.jpg',
      totalBytes: 1000,
      downloadedBytes: 0,
      status: 'idle',
      addedAt: Date.now(),
      retryCount: 0,
    };

    engine.addFile(entry1);
    engine.addFile(entry2);

    const stats = engine.getProgress();
    expect(stats.overallProgress).toBe(0.25); // (500 + 0) / (1000 + 1000)
  });

  it('should remove a file and cleanup resources', async () => {
    const entry: FileEntry = {
      id: 'test-1',
      url: 'https://example.com/test.jpg',
      filename: 'test.jpg',
      totalBytes: 1000,
      downloadedBytes: 500,
      status: 'staged',
      addedAt: Date.now(),
      retryCount: 0,
    };

    engine.addFile(entry);
    await engine.remove('test-1');

    const stats = engine.getProgress();
    expect(stats.totalFiles).toBe(0);
    expect(stats.totalBytes).toBe(0);
    expect(store.delete).toHaveBeenCalledWith('test-1');
  });

  it('should handle retries for failed files', () => {
    const entry: FileEntry = {
      id: 'test-1',
      url: 'https://example.com/test.jpg',
      filename: 'test.jpg',
      totalBytes: 1000,
      downloadedBytes: 0,
      status: 'error',
      errorMessage: 'Network failed',
      addedAt: Date.now(),
      retryCount: 1,
    };

    engine.addFile(entry);
    
    // We need to trigger retry
    engine.retry('test-1');

    const updated = engine.getFile('test-1');
    expect(updated?.status).toBe('queued');
    expect(updated?.errorMessage).toBeUndefined();
  });
});
