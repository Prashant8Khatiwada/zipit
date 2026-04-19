import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBrowserCapabilities, supportsOPFS, supportsFileSystemAccess } from '../../src/utils/capabilities';

describe('Browser capabilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('supportsOPFS', () => {
    it('returns true when navigator.storage.getDirectory exists', () => {
      Object.defineProperty(navigator, 'storage', {
        value: { getDirectory: vi.fn() },
        configurable: true,
      });
      expect(supportsOPFS()).toBe(true);
    });
  });

  describe('supportsFileSystemAccess', () => {
    it('returns false when showDirectoryPicker is absent', () => {
      expect(supportsFileSystemAccess()).toBe(false);
    });
  });

  describe('getBrowserCapabilities', () => {
    it('returns an object with all capability keys', () => {
      const caps = getBrowserCapabilities();
      expect(caps).toHaveProperty('opfs');
      expect(caps).toHaveProperty('fileSystemAccess');
      expect(caps).toHaveProperty('workers');
      expect(caps).toHaveProperty('serviceWorkers');
      expect(caps).toHaveProperty('streams');
    });

    it('returns booleans for all capabilities', () => {
      const caps = getBrowserCapabilities();
      Object.values(caps).forEach((val) => expect(typeof val).toBe('boolean'));
    });
  });
});
