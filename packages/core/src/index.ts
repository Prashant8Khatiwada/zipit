/**
 * @khatiwadaprashant/zipit-core — Public API surface
 *
 * Tree-shakeable exports. Import only what you need:
 *   import { createZipIt } from '@khatiwadaprashant/zipit-core'
 *   import type { ZipItOptions } from '@khatiwadaprashant/zipit-core'
 */

// ─── Factory function (primary API) ─────────────────────────────────────────
export { createZipIt } from './core/factory';
export { DownloadOrchestrator } from './DownloadOrchestrator';
export { ZipPipeline } from './ZipPipeline';
export {
  FileSystemWriter,
  BlobFileSystemWriter,
  type IFileSystemWriter,
} from './fs/FileSystemWriter';
export { default as SessionStore } from './storage/SessionStore';
export {
  default as OpfsStore,
  InMemoryOpfsBackend,
  ZipitQuotaError,
} from './storage/OpfsStore';
export { SpeedCalculator } from './progress/SpeedCalculator';
export { GlobalProgressTracker } from './progress/GlobalProgressTracker';
export {
  SessionRecovery,
  recoverOrCreate,
  type RecoveryPlan,
} from './recovery/SessionRecovery';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  ZipitConfig,
  ZipItInstance,
  AddFileOptions,
  FileDescriptor,
  FileProgress,
  FilePhase,
  GlobalProgress,
  SessionState,
  ProgressHandler,
  ErrorHandler,
  DownloadWorkerInbound,
  DownloadWorkerOutbound,
} from './types';

// ─── Browser feature detection ────────────────────────────────────────────────
export {
  supportsOPFS,
  supportsFileSystemAccess,
  supportsWorkers,
  getBrowserCapabilities,
} from './utils/capabilities';

export {
  supportsOpfs,
  supportsRangeRequests,
  getBestStorageStrategy,
} from './compat';

// ─── Formatting utilities ──────────────────────────────────────────────────────
export { formatBytes, formatEta } from './utils/helpers';

// ─── Version ─────────────────────────────────────────────────────────────────
export const VERSION = '0.1.0';
