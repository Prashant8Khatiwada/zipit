/**
 * @zipit/core — Public API surface
 *
 * Tree-shakeable exports. Import only what you need:
 *   import { createZipIt } from '@zipit/core'
 *   import type { ZipItOptions } from '@zipit/core'
 */

// ─── Factory function (primary API) ─────────────────────────────────────────
export { createZipIt } from './core/factory';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  ZipItOptions,
  ZipItInstance,
  AddFileOptions,
  FileEntry,
  FileStatus,
  ProgressStats,
  ProgressHandler,
  CompleteHandler,
  ErrorHandler,
  FileProgressHandler,
} from './types';

// ─── Browser feature detection ────────────────────────────────────────────────
export {
  supportsOPFS,
  supportsFileSystemAccess,
  supportsWorkers,
  getBrowserCapabilities,
} from './utils/capabilities';

// ─── Formatting utilities ──────────────────────────────────────────────────────
export { formatBytes, formatEta } from './utils/helpers';

// ─── Version ─────────────────────────────────────────────────────────────────
export const VERSION = '0.1.0';
