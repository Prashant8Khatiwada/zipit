# CONTEXT & IDENTITY

I am building a production-grade open-source npm package and SaaS web product called "DropStream" (working title — suggest better names too).

I have previously published an npm package:
https://www.npmjs.com/package/@khatiwadaprashant/react-animation-kit
So I understand the npm publishing workflow. This project should follow similar conventions but be significantly more production-grade, marketizable, and complete.

---
# WHAT WE ARE BUILDING

A dual-layer product:

Layer 1 — npm Package (@dropstream/core or similar):
A framework-agnostic TypeScript library that any developer can install and use in their web project. It must expose:
- A clean, well-documented JavaScript/TypeScript API
- React hooks (e.g. useDownloader, useZipStream) as a separate sub-package
- Vue composables and vanilla JS adapter as optional peer packages
- First-class TypeScript types with full IntelliSense support
- Works in all modern browsers with graceful degradation
- Zero mandatory dependencies (fflate, idb as optional peer deps)

Layer 2 — Standalone Web App / SaaS:
A beautiful, production-grade web app (like Squoosh or Excalidraw) that showcases the library and lets anyone use the downloader without coding. This is the monetization surface — subtle ads, Pro plan, or donation model.

---
# CORE TECHNICAL FEATURES (from existing prototype)

The existing prototype already has these — they must be preserved and elevated:

1. OPFS Staging — Origin Private File System as a high-performance write buffer
2. Multi-threaded Download Workers — download.worker.ts fetches in parallel without blocking UI
3. Resumable Downloads — IndexedDB tracks byte-level progress across page reloads
4. On-the-fly ZIP Streaming — zip.worker.ts compresses in chunks using fflate with no RAM spikes
5. File System Access API — native folder recreation with folder structure preserved
6. Backpressure Queue — balances network speed vs disk write speed intelligently
7. State Machine — Pending → Staged → Transferred lifecycle per file

New feature to add (most important for fotosfolio use case):
Client-side ZIP generation — instead of zipping files on the server (expensive, slow, blocking), 
the library should stream-zip files directly in the browser as they download, 
and deliver the ZIP to the user's disk without ever loading all data into RAM.
The package should make this as simple as:
  dropstream.zip(fileUrls, 'my-photos.zip')

---
# PACKAGE ARCHITECTURE TO DESIGN

Please design and scaffold the full monorepo structure:

Monorepo (using pnpm workspaces or turborepo):
  packages/
    core/          ← framework-agnostic engine
    react/         ← React hooks wrapping core
    vue/           ← Vue composables (optional)
  apps/
    web/           ← standalone SaaS web app
    docs/          ← documentation site (Starlight or VitePress)

Each package must have:
- Proper package.json with exports map, types, sideEffects: false
- tsconfig.json extending shared config
- Vite library mode build outputting ESM + CJS + .d.ts
- Vitest unit tests with coverage

---
# API DESIGN (suggest improvements too)

The public API must be elegant and minimal. Draft the full TypeScript API surface:

Core API:
  const ds = createDropStream(options)
  ds.add(url, { filename, folder, metadata })
  ds.start() / ds.pause() / ds.resume() / ds.cancel()
  ds.on('progress', handler)
  ds.on('complete', handler)
  ds.on('error', handler)
  ds.zip(outputFilename)
  ds.saveToFolder()     ← File System Access API path

React hook:
  const { files, progress, start, pause, zip } = useDropStream(options)

---
# PRODUCTION-GRADE REQUIREMENTS

This must be a proper open-source project that earns GitHub stars and npm downloads:

Documentation:
- README.md with badges (npm version, bundle size, license, tests passing)
- Getting Started in under 5 lines of code
- Full API reference with TypeScript signatures
- Migration guide from server-side zipping approach
- Browser compatibility table

DX (Developer Experience):
- npm create dropstream@latest scaffold command
- JSDoc comments on every export
- Error messages that tell you what went wrong AND how to fix it
- CHANGELOG.md following Keep a Changelog format

Quality:
- >90% test coverage
- Bundle size badge (target: core < 12kB gzipped)
- CI/CD via GitHub Actions: test → build → publish on tag
- Semantic versioning with conventional commits

Naming:
Suggest 5 alternative production-grade, marketizable package names. Criteria:
- Memorable, domain-available
- Conveys speed/streaming/downloading
- Not taken on npm
- .com or .dev domain likely available
- Works as a GitHub org name too

---
# UI/UX FOR THE WEB APP

The standalone web app (apps/web) must feel like a premium developer tool — think Linear, Vercel, or Raycast's visual language:

- Dark mode first, with smooth light mode toggle
- Drag-and-drop URL list input or paste from clipboard
- Real-time per-file progress bars with speed (MB/s), ETA, file size
- Global progress ring + summary stats
- Queue visualization — see active, pending, done files at a glance
- One-click ZIP download button that streams without server
- Keyboard shortcuts (Space = pause, R = resume, Esc = cancel)
- Responsive — works on tablet/mobile too (degrades gracefully where OPFS not available)
- Subtle monetization: "Powered by DropStream — open source" footer with npm link

---
# MONETIZATION & GROWTH STRATEGY

Think through how this becomes a real product:
- npm package: free, open source (MIT) — builds reputation
- Web app: free with subtle tasteful ads via Carbon Ads or EthicalAds (developer-focused ad networks)
- Pro plan ideas: no ads, priority queue, custom branding for embedded use, team workspace
- SEO strategy: target "download files in browser", "browser zip download", "client side zip javascript"
- Show GitHub star count prominently
- Submit to: Hacker News Show HN, Product Hunt, CSS-Tricks, dev.to article

---
# DELIVERABLES REQUESTED

Please provide in order:

1. 5 name suggestions with rationale (pick the best one going forward)
2. Full monorepo scaffold — every file and folder with content
3. Core package implementation — complete TypeScript source
4. React package — hooks with full types
5. ZIP streaming implementation — the key new feature
6. README.md — production-grade, with badges and clear examples
7. GitHub Actions CI/CD — test, build, publish workflow
8. Web app — complete Vite app with premium UI
9. Docs site config — VitePress or Starlight setup

Start with step 1 (naming) and step 2 (scaffold), then proceed through the rest.
After each step, pause and ask if I want changes before continuing.

---
# CONSTRAINTS

- TypeScript strict mode throughout
- No class-based APIs — prefer functional, composable design
- Tree-shakeable exports only
- No React dependency in core package
- Must work without a build step when imported as ESM from CDN (unpkg/jsdelivr)
- Browser-only (no Node.js target for core)
