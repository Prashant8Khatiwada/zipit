# @khatiwadaprashant/zipit-react ⚛️

[![npm version](https://img.shields.io/npm/v/@khatiwadaprashant/zipit-react?color=7c6fff&style=flat-square)](https://www.npmjs.com/package/@khatiwadaprashant/zipit-react)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@khatiwadaprashant/zipit-react?label=react%20gzipped&color=22d3a0&style=flat-square)](https://bundlephobia.com/package/@khatiwadaprashant/zipit-react)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?style=flat-square)](https://www.typescriptlang.org/)

> **The easiest way to add high-performance, resumable downloads and client-side zipping to your React app.**

React hooks for [@khatiwadaprashant/zipit-core](https://github.com/Prashant8Khatiwada/zipit/tree/main/packages/core).

---

## Installation

```bash
npm install @khatiwadaprashant/zipit-react @khatiwadaprashant/zipit-core fflate
# or
pnpm add @khatiwadaprashant/zipit-react @khatiwadaprashant/zipit-core fflate
```

---

## Basic Usage

The `useZipIt` hook provides everything you need to manage a batch download session.

```tsx
import { useZipIt } from '@khatiwadaprashant/zipit-react';

function PhotoDownloader({ images }) {
  const { 
    add, 
    start, 
    zip, 
    progress, 
    isBusy, 
    files 
  } = useZipIt({ 
    concurrency: 4,
    onComplete: (stats) => console.log('Finished!', stats)
  });

  const handleDownload = () => {
    images.forEach(img => add(img.url, { filename: img.name }));
    start({ saveToFolder: true });
  };

  return (
    <div className="p-4 border rounded-xl bg-card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Download Queue</h3>
        <div className="flex gap-2">
          <button 
            onClick={handleDownload}
            disabled={isBusy}
            className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
          >
            Save to Folder
          </button>
          <button 
            onClick={() => zip('my-archive.zip')}
            disabled={isBusy}
            className="px-4 py-2 border border-primary text-primary rounded-lg"
          >
            Download ZIP
          </button>
        </div>
      </div>

      {/* Progress Visualization */}
      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${progress.overallProgress * 100}%` }}
        />
      </div>
      
      <p className="mt-2 text-sm text-muted-foreground">
        {progress.completedFiles} / {progress.totalFiles} files ready
      </p>
    </div>
  );
}
```

---

## Features

- **🔄 Declarative State**: Real-time updates for progress, speed, ETA, and file states.
- **⚡ Zero RAM Spikes**: Files are streamed to disk/ZIP without loading them into memory.
- **🛡️ Resumable**: Automatically restores previous sessions via IndexedDB.
- **📁 Folder Preservation**: Recreates complex directory structures on the user's disk.
- **🧩 TypeScript First**: Full IntelliSense support for options and returned state.

---

## API Reference

### `useZipIt(options)`

#### Options
Inherits all options from `ZipItCoreOptions`.

| Option | Type | Default | Description |
|---|---|---|---|
| `concurrency` | `number` | `3` | Number of parallel downloads |
| `onProgress` | `(stats) => void` | — | Global progress callback |
| `onFileProgress` | `(file) => void` | — | Called when a single file's state changes |
| `onComplete` | `(stats) => void` | — | Called when all files are finished |

#### Return Value

| Property | Type | Description |
|---|---|---|
| `files` | `FileEntry[]` | Array of current files in the queue |
| `progress` | `ProgressStats` | Object containing `overallProgress`, `speed`, `eta`, etc. |
| `isBusy` | `boolean` | True if a download or zip process is active |
| `isPaused` | `boolean` | True if the queue is paused |
| `add` | `(url, opts) => void` | Add a single file to the queue |
| `addAll` | `(urls, opts) => void` | Add multiple files |
| `start` | `(opts) => Promise` | Start the download process |
| `pause` | `() => void` | Pause active downloads |
| `resume` | `() => void` | Resume paused downloads |
| `cancel` | `() => void` | Cancel all and clear queue |
| `zip` | `(name) => Promise` | Generate and download a ZIP stream |
| `saveToFolder` | `() => Promise` | Pick a folder and transfer files |

---

## Advanced: Individual File Progress

```tsx
const { files } = useZipIt();

return (
  <ul>
    {files.map(file => (
      <li key={file.id}>
        {file.filename}: {Math.round(file.progress * 100)}%
        <span>Status: {file.status}</span>
      </li>
    ))}
  </ul>
)
```

---

## License

MIT © Prashant Khatiwada
