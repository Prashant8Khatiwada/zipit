Harden the zipit monorepo for production. Address each of these in sequence:

1. Bundle Size Audit (packages/core):
   - Run `npx vite-bundle-visualizer` on the core package
   - Ensure fflate is only bundled in zip.worker.ts (tree-shaken from main bundle)
   - Target: core main bundle < 15KB gzipped (excluding workers)

2. Web Worker Bundling:
   - Configure Vite to inline workers as base64 blobs using `?worker&inline`
   - Ensure workers work correctly in both dev and production builds
   - Test that OPFS operations work in worker context (not main thread)

3. Cross-Browser Compatibility Layer:
   Write a packages/core/src/compat.ts file that exports:
   - supportsOpfs(): boolean
   - supportsFileSystemAccess(): boolean  
   - supportsRangeRequests(url: string): Promise<boolean>  (makes a HEAD request)
   - getBestStorageStrategy(): 'opfs' | 'memory' | 'indexeddb-chunks'
   
   Also add a memory fallback for OpfsStore: MemoryOpfsStore implements the same interface using Map<string, Uint8Array[]>. Used automatically when OPFS is unavailable.

4. Error Boundaries:
   In packages/react: add a <ZipItErrorBoundary> component that catches errors from the engine and shows a recovery UI.

5. E2E Tests:
   Set up Playwright in apps/web/. Write 3 tests:
   a. Happy path: add 2 mock URLs (use msw to mock fetch), start download, verify ZIP dialog triggered
   b. Resume: simulate page reload mid-download, verify recovery banner appears
   c. Error handling: mock a 404 response, verify error state displayed

Output: All code changes + a CHECKLIST.md in the root summarizing what was hardened and what still needs manual testing.