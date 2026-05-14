# Changelog

All notable changes to DropStream packages will be documented in this file.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-14

### Added
- **Production-Grade Engine**: Hardened worker lifecycle with fetch timeouts and auto-retry logic (exponential backoff).
- **Core APIs**: Added `retry()`, `retryFailed()`, `remove()`, `update()`, and `getFile()` to `ZipItInstance`.
- **Storage Management**: New `getStorageEstimate()` API to monitor browser storage quotas.
- **O(1) Progress Tracking**: Refactored `DownloadEngine` to use deltas for statistics, eliminating array iteration on every progress tick.
- **Improved ZIP Flow**: `ds.zip()` now respects concurrency by leveraging `DownloadEngine` for parallel staging in OPFS.
- **Deduplication**: Integrated URL + Folder hashing to prevent redundant downloads.
- **Security**: Filename sanitization to mitigate path traversal risks.

### Changed
- **Async addAll**: `ds.addAll()` is now async to support high-performance batched IndexedDB operations.
- **Stable React Hooks**: `useZipIt` now uses stable refs for callbacks, preventing unnecessary re-renders.
- **Enhanced Types**: Full TypeScript coverage for all new lifecycle events and methods.

### Fixed
- Fixed race conditions during worker termination.
- Resolved `QuotaExceededError` handling in OPFS workers.
- Fixed potential hangs in `hydrate()` using a configurable timeout.


## [0.1.0] - 2026-04-18

### Added
- Initial release of prototype codebase
- Basic batch download manager
- OPFS staging + local disk transfer
- ZIP streaming via fflate
- IndexedDB state persistence
