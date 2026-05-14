# ZipIt ⚡

[![npm version](https://img.shields.io/npm/v/@khatiwadaprashant/zipit-core?color=7c6fff&style=flat-square)](https://www.npmjs.com/package/@khatiwadaprashant/zipit-core)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@khatiwadaprashant/zipit-core?label=core%20gzipped&color=22d3a0&style=flat-square)](https://bundlephobia.com/package/@khatiwadaprashant/zipit-core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/github/actions/workflow/status/rochaksulu/zipit/ci.yml?label=tests&style=flat-square)](https://github.com/Prashant8Khatiwada/zipit/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)](https://www.typescriptlang.org/)

> **Client-side ZIP streaming and resumable batch download library for the browser.**
> No server. No RAM spikes. No compromise.

[**→ Live Demo**](https://zipit.dev) · [**Documentation**](https://zipit.dev/docs) · [**npm**](https://www.npmjs.com/package/@khatiwadaprashant/zipit-core)

---

## 🌟 The DropStream / ZipIt Web App
We've built a premium, standalone Web App demonstrating the full power of the ZipIt core engine. It features a modern, responsive UI with real-time progress visualization, drag-and-drop URL lists, and one-click client-side ZIP downloads.

Check out the source in `apps/web` or try it live at [zipit.dev](https://zipit.dev).

---

## Why ZipIt?

Traditional file downloads are broken for large batches:

| Problem | Typical approach | ZipIt |
|---|---|---|
| **Zipping on the server** | CPU/memory spike, blocks requests | ✅ Zipped in browser, zero server cost |
| **RAM exhaustion** | Load all files into memory | ✅ OPFS staging with backpressure |
| **Lost progress on refresh** | Start over | ✅ Byte-level resumability via IndexedDB |
| **Flat directory output** | No folder structure | ✅ Native folder structure preserved |
| **Browser memory limits** | Crash on 1GB+ | ✅ Streaming writes below 5 MB working set |

---

## 🚀 Quick Start

### Core Library (Framework Agnostic)

```bash
pnpm add @khatiwadaprashant/zipit-core fflate
```

**In 5 lines:**
```ts
import { createZipIt } from '@khatiwadaprashant/zipit-core';

const ds = createZipIt({ concurrency: 4 });
ds.add('https://example.com/photo1.jpg', { folder: 'photos/2024' });
ds.add('https://example.com/photo2.jpg', { folder: 'photos/2024' });
await ds.zip('my-photos.zip'); // ← Streams to disk. No RAM spike. No server.
```

### React Hooks

```bash
pnpm add @khatiwadaprashant/zipit-react @khatiwadaprashant/zipit-core fflate
```

```tsx
import { useZipIt } from '@khatiwadaprashant/zipit-react';

function Gallery({ urls }) {
  const { add, start, zip, progress, isBusy } = useZipIt({ concurrency: 4 });

  return (
    <div className="p-4 border rounded-xl bg-card">
      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${progress.overallProgress * 100}%` }}
        />
      </div>
      
      <p className="mt-2 text-sm">{(progress.overallProgress * 100).toFixed(1)}% Completed</p>
      
      <div className="flex gap-2 mt-4">
        <button 
          onClick={() => { urls.forEach(u => add(u)); start({ saveToFolder: true }); }}
          disabled={isBusy}
        >
          Download to Folder
        </button>
        <button 
          onClick={() => zip('gallery.zip')}
          disabled={isBusy}
        >
          Download as ZIP
        </button>
      </div>
    </div>
  );
}
```

---

## 📘 Comprehensive Integration Guide

For a complete breakdown of architecture, file lifecycle, API surface, and advanced usage patterns, please refer to the [**ZIPIT_INTEGRATION.md**](./ZIPIT_INTEGRATION.md) file. It serves as the authoritative developer blueprint.

---

## ⚙️ Core Features

### 1. Client-side ZIP Streaming
ZIP files are assembled in the browser using streaming compression — files are compressed as they download, chunk by chunk. Works offline for cached OPFS files.

### 2. OPFS Staging Pipeline
Files are downloaded into the Origin Private File System (OPFS) for maximum throughput, then streamed to the user's local folder:
`Network → [Download Worker] → OPFS → [Main Thread] → Local Disk`

### 3. Byte-level Resumability
Downloads survive page refreshes, browser crashes, and navigation. Use `ds.hydrate()` on mount to restore the previous session.

### 4. Folder Structure Preservation
```ts
ds.add('https://cdn.example.com/img1.jpg', { folder: 'photos/london/2024' });
await ds.start({ saveToFolder: true });
// → saves as: MyFolder/photos/london/2024/img1.jpg
```

### 5. Intelligent Backpressure
Two-layer backpressure prevents RAM from spiking when disk is slower than network, ensuring smooth performance even on low-end devices.

---

## 🌐 Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Download + ZIP (core) | ✅ 102+ | ✅ 102+ | ✅ 111+ | ✅ 15.4+ |
| OPFS Staging | ✅ | ✅ | ✅ | ✅ 16+ |
| Native Folder Save | ✅ | ✅ | ❌ (ZIP fallback) | ❌ (ZIP fallback) |
| Resumable downloads | ✅ | ✅ | ✅ | ✅ |

---

## 🛠️ Development

This project uses `pnpm` workspaces.

```bash
# Install all workspace deps
pnpm install

# Run the standalone web app
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build

# Publish to npm (using Changesets)
pnpm changeset version
pnpm release
```

---

## 🤝 Contributing

PRs welcome! Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## 📝 License

MIT © Prashant Khatiwada
