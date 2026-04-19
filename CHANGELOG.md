# Changelog

All notable changes to DropStream packages will be documented in this file.

This project adheres to [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Full monorepo scaffold with pnpm workspaces
- `@dropstream/core` — framework-agnostic download + ZIP engine
- `@dropstream/react` — `useDropStream` and `useZip` hooks
- OPFS-backed multi-threaded download workers
- Byte-level resumable downloads via IndexedDB
- On-the-fly ZIP streaming with two-layer backpressure
- File System Access API support for native folder saving
- Smart failover (HEAD request on 4xx/5xx)
- GitHub Actions CI/CD pipeline
- Premium SaaS web app with real-time queue visualization
- Keyboard shortcuts (Space, R, Esc)
- Browser capability detection with graceful degradation
- Full TypeScript strict mode with JSDoc on every export

## [0.1.0] - 2026-04-18

### Added
- Initial release of prototype codebase
- Basic batch download manager
- OPFS staging + local disk transfer
- ZIP streaming via fflate
- IndexedDB state persistence
