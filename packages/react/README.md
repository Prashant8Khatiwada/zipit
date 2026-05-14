# @khatiwadaprashant/zipit-react ⚛️

[![npm version](https://img.shields.io/npm/v/@khatiwadaprashant/zipit-react?color=7c6fff&style=flat-square)](https://www.npmjs.com/package/@khatiwadaprashant/zipit-react)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@khatiwadaprashant/zipit-react?label=react%20gzipped&color=22d3a0&style=flat-square)](https://bundlephobia.com/package/@khatiwadaprashant/zipit-react)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)](https://www.typescriptlang.org/)

> **The professional React hooks for high-performance, resumable downloads and client-side ZIP streaming.**
> Powered by [ZipIt Core](https://github.com/Prashant8Khatiwada/zipit/tree/main/packages/core).

---

## 🚀 Installation

```bash
pnpm add @khatiwadaprashant/zipit-react @khatiwadaprashant/zipit-core fflate
```

---

## 💻 Usage

The `useZipIt` hook manages the entire lifecycle of a download batch, providing reactive state for progress, speed, and file statuses.

```tsx
import { useZipIt } from '@khatiwadaprashant/zipit-react';

function GalleryDownloader({ photos }) {
  const { 
    add, 
    start, 
    zip, 
    progress, 
    isBusy 
  } = useZipIt({ 
    concurrency: 4,
    onComplete: () => alert('All files downloaded!')
  });

  const handleDownload = () => {
    // 1. Add files to the queue
    photos.forEach(p => add(p.url, { filename: p.name, folder: 'vacation' }));
    
    // 2. Start downloading to OPFS staging
    start();
  };

  return (
    <div className="downloader-card">
      <div className="controls">
        <button onClick={handleDownload} disabled={isBusy}>
          {isBusy ? 'Downloading...' : 'Start Download'}
        </button>
        <button onClick={() => zip('gallery.zip')} disabled={isBusy}>
          Download ZIP
        </button>
      </div>

      {/* Modern Progress Bar */}
      <div className="progress-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progress.overallProgress * 100}%` }} 
        />
      </div>
      
      <p>{Math.round(progress.overallProgress * 100)}% Complete</p>
    </div>
  );
}
```

---

## ✨ Features

- **🔄 Declarative State**: Real-time progress, speed (MB/s), and ETA updates.
- **⚡ Zero RAM Spikes**: Streams directly from network → OPFS → Local Disk/ZIP.
- **🛡️ Resumable**: Survive page refreshes and crashes; session restores automatically.
- **📁 Folder Preservation**: Recreates directory structures on the user's filesystem.
- **🧩 TypeScript First**: Full types for all options and state.

---

## 🛠 API Reference

### `useZipIt(options)`

#### Options
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `concurrency` | `number` | `3` | Concurrent network requests |
| `onProgress` | `(stats) => void` | — | Global progress listener |
| `onComplete` | `(stats) => void` | — | Fired when batch is 100% complete |
| `onError` | `(err, file) => void` | — | Per-file error handler |

#### Return Value
- `files`: `FileEntry[]` - Reactive list of files and their statuses.
- `progress`: `ProgressStats` - `{ overallProgress, totalBytes, speed, eta }`.
- `isBusy`: `boolean` - Active download or zip operation.
- `add(url, options)`: Add file to queue.
- `start(options)`: Begin processing.
- `zip(filename)`: Finalize queue into a ZIP stream.
- `pause()` / `resume()` / `cancel()`: Lifecycle controls.

---

## 📄 License

MIT © [Prashant Khatiwada](https://github.com/Prashant8Khatiwada)
