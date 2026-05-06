⚡ zipit — Implementation Plan & Phase-wise Prompt List

Working Title: DropStream
Stack: TypeScript · Web Workers · IndexedDB · OPFS · fflate · React · Vite
Goal: Production-grade, client-side multi-file download + on-the-fly ZIP streaming library & SaaS platform.


📐 Architecture Overview (Before You Code)
monorepo/
├── packages/
│   ├── core/          # Framework-agnostic engine (Workers, OPFS, IndexedDB, ZIP)
│   └── react/         # useZipIt hooks + headless UI components
├── apps/
│   ├── web/           # SaaS flagship (Next.js or Vite + React)
│   └── docs/          # Documentation site (Astro or Nextra)
└── tooling/
    ├── tsconfig/
    ├── eslint/
    └── vitest/
Threading Model:
Main Thread  →  DownloadOrchestrator (light, state relay only)
                    ↓
Worker Pool  →  [DownloadWorker x N]  →  OPFS writes
                    ↓
ZIP Worker   →  [ZipStreamWorker x1]  →  File System Access API (disk)

🗺️ Phase Breakdown
PhaseFocusEst. Complexity0Monorepo scaffolding & toolingLow1Core engine & resumabilityVery High2Progress & state managementHigh3ZIP streaming & File System APIVery High4React adapter & UI componentsMedium5SaaS web app launchHigh

✅ Execution Checklist
Use this after completing each phase:
Phase 0

 pnpm install succeeds at root
 pnpm -r build compiles all packages without errors
 pnpm test runs Vitest with 0 failures

Phase 1

 SessionStore CRUD operations tested with fake-indexeddb
 OpfsStore write + read round-trip tested (mock OPFS)
 DownloadWorker sends correct message types
 Orchestrator respects concurrency limit
 Resume correctly computes startByte from OPFS

Phase 2

 SpeedCalculator returns 0 on empty state
 Weighted average is higher for more recent bytes
 GlobalProgressTracker correctly aggregates per-file progress
 RecoveryPlan correctly categorizes all 3 file states

Phase 3

 ZIP worker produces a valid .zip file (validate with JSZip in test)
 FileSystemWriter fallback works in Firefox
 Backpressure prevents OOM on large files

Phase 4

 useZipIt state transitions match expected lifecycle
 All headless components render without errors in Storybook
 ZipItUI is visually correct at 320px, 768px, 1440px

Phase 5

 Lighthouse score > 90 on /app
 E2E tests pass in Chromium, Firefox, WebKit
 Bundle size targets met
 Docs site builds and deploys to Vercel


🔑 Key Dependencies
PackageVersionPurposefflate^0.8ZIP compression in workeridb^8IndexedDB wrapper (optional, can use raw IDB)react^18React adaptervite^5Build toolvitest^1Unit testingplaywright^1.4E2E testingastro^4Docs site@astrojs/starlightlatestDocs themetsup^8Library bundler

This plan is designed to be executed prompt-by-prompt in a single AI coding session per prompt. Each prompt is self-contained with clear inputs, outputs, and acceptance criteria.