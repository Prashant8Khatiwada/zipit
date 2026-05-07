import '@testing-library/react';
import { vi } from 'vitest';

// Mock ResizeObserver which is not present in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
