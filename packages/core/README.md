# ZipIt ⚡️

[![npm version](https://img.shields.io/npm/v/@khatiwadaprashant/zipit-core?color=7c6fff&style=flat-square)](https://www.npmjs.com/package/@khatiwadaprashant/zipit-core)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@khatiwadaprashant/zipit-core?label=core%20gzipped&color=22d3a0&style=flat-square)](https://bundlephobia.com/package/@khatiwadaprashant/zipit-core)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Tests Passing](https://img.shields.io/github/actions/workflow/status/Prashant8Khatiwada/zipit/ci.yml?label=tests&style=flat-square)](https://github.com/Prashant8Khatiwada/zipit/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)](https://www.typescriptlang.org/)

> **The professional, high-performance ZIP streaming and resumable downloader for modern browsers.**
> No server-side zipping. No RAM spikes. Zero compromise.

[**→ Try the Demo**](https://zipit.dev) · [**API Reference**](https://zipit.dev/docs) · [**GitHub**](https://github.com/Prashant8Khatiwada/zipit)

---

## ⚡️ Why ZipIt?

Traditional file downloads in the browser are broken for large batches. ZipIt solves this by using **Origin Private File System (OPFS)** for staging and **on-the-fly streaming compression**.

| The Problem | Traditional Approach | **ZipIt Solution** |
| :--- | :--- | :--- |
| **Server Load** | Zipping on server blocks CPU/RAM | ✅ **0% Server CPU.** Zipped in browser. |
| **RAM Usage** | Loading all files into memory | ✅ **5MB Working Set.** Streams to disk. |
| **Persistence** | Refresh loses everything | ✅ **Resumable.** IDB tracks byte-level progress. |
| **Structure** | Flat file lists | ✅ **Folder Preservation.** Recreates folders. |
| **Large Files** | Crash on 1GB+ batches | ✅ **Unlimited.** Limited only by disk space. |

---

## 🚀 Getting Started

### 1. Install

```bash
pnpm add @khatiwadaprashant/zipit-core fflate
```

### 2. Basic Usage (5 Lines)

```typescript
import { createZipIt } from '@khatiwadaprashant/zipit-core';

const ds = createZipIt({ concurrency: 4 });

// Add files with folder structure
ds.add('https://api.example.com/photo.jpg', { folder: 'travel/2024' });

// Stream-zip directly to user's disk
await ds.zip('my-archive.zip'); 
```

### 3. Native Folder Save (Zero ZIP needed)

```typescript
// Recreates the folder structure directly on the user's local disk
await ds.start({ saveToFolder: true });
```

---

## 📘 Core Architecture

### 1. Client-Side ZIP Streaming
ZipIt uses a high-performance worker-based pipeline. As bytes are fetched from the network, they are fed into a `fflate` stream, which pumps compressed chunks directly to the user's disk via the File System Access API.

### 2. OPFS Staging Pipeline
To handle network instability, ZipIt stages files in the **Origin Private File System**. This allows for:
- **Resumable Downloads**: If the user refreshes, we know exactly how many bytes we have.
- **Backpressure**: We pause the network fetch if the disk write speed falls behind.

### 3. Byte-Level Resumability
```typescript
// On app mount: restore the previous session automatically
const pending = await ds.hydrate();
if (pending.length > 0) {
  console.log(`Resuming ${pending.length} files...`);
  ds.start();
}
```

---

## 🛠 API Reference

### `createZipIt(options)`
Creates a new manager instance.
- `concurrency`: Number of parallel download workers (Default: `3`).
- `dbName`: IndexedDB name for state persistence (Default: `'zipit_v1'`).
- `onProgress`: Global progress callback.

### `Instance Methods`
- `ds.add(url, options)`: Queue a file.
- `ds.start(options)`: Begin downloading/transferring.
- `ds.pause()` / `ds.resume()`: Control the queue.
- `ds.zip(filename)`: Generate and download a ZIP stream.
- `ds.hydrate()`: Restore session from IndexedDB.

---

## 🌐 Browser Compatibility

| Feature | Chrome / Edge | Firefox | Safari |
| :--- | :--- | :--- | :--- |
| **Streaming ZIP** | ✅ 102+ | ✅ 111+ | ✅ 15.4+ |
| **OPFS Staging** | ✅ | ✅ | ✅ 16+ |
| **Folder Save** | ✅ (Native) | ⚠️ (ZIP Fallback) | ⚠️ (ZIP Fallback) |
| **Resumability** | ✅ | ✅ | ✅ |

---

## 🤝 Contributing

We love contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) and follow [Conventional Commits](https://www.conventionalcommits.org/).

## 📝 License

MIT © [Prashant Khatiwada](https://github.com/Prashant8Khatiwada)

