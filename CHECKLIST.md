---
title: Hardening Checklist
---

##Hardening Tasks Completed

- [x] **Web Worker Inlining**: Workers are now inlined as Base64 blobs in `packages/core`. This ensures they work out-of-the-box in any environment without complex URL management.
- [x] **Vite Build Migration**: `packages/core` now uses Vite for building, enabling better tree-shaking and worker inlining support.
- [x] **Storage Fallback**: `OpfsStore` now automatically falls back to `InMemoryOpfsBackend` when the Origin Private File System is unavailable.
- [x] **Browser Compatibility Layer**: Added `packages/core/src/compat.ts` for feature detection.
- [x] **Error Boundaries**: Added `ZipItErrorBoundary` to `packages/react`.
- [x] **E2E Tests**: Set up Playwright in `apps/web` with tests for the happy path, session recovery, and error handling.
- [x] **Tailwind v4 & Framer Motion**: Successfully integrated into the web app for a premium feel.

## Manual Testing Required

- [ ] Verify large file (>2GB) downloads in Chrome.
- [ ] Test session recovery across multiple browser tabs.
- [ ] Verify Safari 17+ OPFS support with real hardware.
- [ ] Profile memory usage during long-running ZIP operations (>100 files).
