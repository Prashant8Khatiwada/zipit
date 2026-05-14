# ZipIt Integration Reference

> **This document is the complete, authoritative reference for integrating the ZipIt download and client-side ZIP streaming library into any project. Read it fully before writing any code.**

---

## 1. What Is ZipIt?

ZipIt (`@khatiwadaprashant/zipit-core`) is a **browser-only**, framework-agnostic TypeScript library that enables:

- **Resumable batch downloads** — survives page refreshes via IndexedDB
- **OPFS staging** — files are written to the Origin Private File System (private browser disk) using a Web Worker, never to RAM
- **Client-side ZIP streaming** — multiple files are compressed into a single `.zip` archive as they are downloaded, without loading them into memory
- **Native folder saving** — preserves full directory structure via the File System Access API (Chrome/Edge only)
- **Intelligent backpressure** — network speed is balanced against disk write speed to prevent memory spikes

There is also a React bindings package: `@khatiwadaprashant/zipit-react`.

---

## 2. Installation

### Vanilla JS / TypeScript
```bash
pnpm add @khatiwadaprashant/zipit-core fflate
# or
npm install @khatiwadaprashant/zipit-core fflate
```

### React
```bash
pnpm add @khatiwadaprashant/zipit-react @khatiwadaprashant/zipit-core fflate
```

> `fflate` is a **required** peer dependency. It is the compression engine used for ZIP streaming.

---

## 3. Architecture & How It Works

```
User calls ds.add() / ds.start()
        │
        ▼
  DownloadEngine (main thread)
  ├── Dispatches URLs to download.worker.ts (Web Worker)
  │       │
  │       ▼
  │   download.worker.ts fetches URL in chunks
  │   └── Writes chunks to OPFS via FileSystemSyncAccessHandle
  │
  ├── File status: idle → queued → downloading → staged
  │
  └── When all files are staged:
      ├── saveToFolder() → streams OPFS → user's local disk (FSA API)
      └── zip() → streams OPFS → zip.worker.ts (fflate) → user's disk as .zip
```

**Key principle:** Files are NEVER fully loaded into RAM. The working memory footprint is bounded to ~5MB (configurable via `streamBufferBytes`).

---

## 4. File Status Lifecycle

Every file tracked by ZipIt has one of these statuses:

| Status | Description |
|:---|:---|
| `idle` | Added to the queue, `start()` not yet called |
| `queued` | Waiting for a free worker slot |
| `downloading` | Actively being fetched and written to OPFS |
| `staged` | Fully in OPFS, waiting to be transferred or zipped |
| `transferring` | Being streamed from OPFS to the user's local disk |
| `done` | Successfully saved or zipped |
| `paused` | Download is mid-flight but paused by the user |
| `error` | Failed — check `file.errorMessage` for details |

---

## 5. Core API (`@khatiwadaprashant/zipit-core`)

### 5.1 Creating an Instance

```ts
import { createZipIt } from '@khatiwadaprashant/zipit-core';

const ds = createZipIt(options);
```

**`createZipIt(options?: ZipItOptions): ZipItInstance`**

#### `ZipItOptions`

| Option | Type | Default | Description |
|:---|:---|:---|:---|
| `concurrency` | `number` | `3` | Number of files to download simultaneously. Keep between 3–5 to avoid CDN rate limits. |
| `zipBackpressureLimit` | `number` | `10` | Max in-flight ZIP chunks in the worker mailbox. Higher = faster, more RAM. |
| `streamBufferBytes` | `number` | `5242880` (5MB) | Max bytes buffered in the ReadableStream. Increase only for very fast connections. |
| `dbName` | `string` | `'zipit_v1'` | IndexedDB database name. Change this if running multiple ZipIt instances on the same origin. |
| `onProgress` | `ProgressHandler` | — | Called on every animation frame tick during download. |
| `onComplete` | `CompleteHandler` | — | Called once when all files reach `done` status. |
| `onError` | `ErrorHandler` | — | Called when any file fails unrecoverably. |
| `onFileProgress` | `FileProgressHandler` | — | Called when an individual file's state or progress changes. |

---

### 5.2 Adding Files

```ts
// Add a single file
const entry: FileEntry = ds.add(url, options);

// Add multiple files
const entries: FileEntry[] = await ds.addAll(urls, options);
```

#### `AddFileOptions`

| Option | Type | Description |
|:---|:---|:---|
| `filename` | `string` | Override the filename. If omitted, derived from URL pathname. |
| `folder` | `string` | Relative folder path (e.g. `'photos/2024/trip'`). Used to recreate directory structure. |
| `totalBytes` | `number` | Known file size in bytes. Improves progress accuracy if provided. |
| `metadata` | `Record<string, unknown>` | Any custom data. Survives page reloads via IndexedDB hydration. |

```ts
// Example: Add files with folder structure
ds.add('https://cdn.example.com/img1.jpg', {
  filename: 'beach-sunset.jpg',
  folder: 'Vacation/Day1',
  metadata: { albumId: 42 }
});
```

---

### 5.3 Lifecycle Controls

```ts
// Start downloading all queued files
await ds.start({ saveToFolder: true });
// - saveToFolder: true → prompts user to pick a folder (Chrome/Edge only)
// - saveToFolder: false (default) → files are staged in OPFS only

// Pause all active downloads (byte-level, resumable)
ds.pause();

// Resume paused downloads
ds.resume();

// Retry a specific failed file
ds.retry(fileId);

// Retry all files currently in 'error' status
ds.retryFailed();

// Remove a file from the queue and delete its OPFS cache
await ds.remove(fileId);

// Update file metadata or filename before starting
ds.update(fileId, { filename: 'new-name.jpg' });

// Cancel downloads and clear the queue
// Note: Does NOT delete already-staged OPFS files. Call ds.reset() for full wipe.
ds.cancel();
```

---

### 5.4 Output Methods

```ts
// Stream-zip all queued files directly to the user's disk as a .zip
// Does NOT require start() to be called first.
await ds.zip('my-photos.zip');

// Prompt folder picker and save staged files with directory structure preserved
// Requires: File System Access API (Chrome/Edge only)
await ds.saveToFolder();
```

> **Important:** `ds.zip()` and `ds.start({ saveToFolder: true })` are mutually exclusive output paths. Use `zip()` when you want a `.zip` file, and `start()` when you want individual files in a folder.

---

### 5.5 Events

`ds.on()` returns an **unsubscribe function**. Always call it on cleanup.

```ts
const unsubscribe = ds.on('progress', (stats: ProgressStats) => {
  console.log(`${(stats.overallProgress * 100).toFixed(1)}%`);
});

// Later, on cleanup:
unsubscribe();

// All events:
ds.on('progress',      (stats: ProgressStats) => void)
ds.on('complete',      (stats: ProgressStats) => void)
ds.on('error',         (error: Error, file: FileEntry) => void)
ds.on('file-progress', (file: FileEntry) => void)
ds.on('file-removed',  (file: FileEntry) => void)
```

---

### 5.6 State Inspection

```ts
// Get all tracked files
const filesMap: Map<string, FileEntry> = ds.getFiles();

// Get a single file by ID
const file = ds.getFile(fileId);

// Get storage quota/usage estimate
const { usage, quota } = await ds.getStorageEstimate();

// Get the latest progress snapshot
const stats: ProgressStats = ds.getProgress();

// Boolean state checks
const paused: boolean = ds.isPaused();
const busy: boolean   = ds.isBusy();
```

---

### 5.7 Session Management

```ts
// CALL THIS ON MOUNT — restores any interrupted session from IndexedDB
const interrupted: FileEntry[] = await ds.hydrate();
if (interrupted.length > 0) {
  // Offer the user the option to resume
  await ds.start({ saveToFolder: true });
}

// Full reset — clears IndexedDB state AND OPFS cache
await ds.reset();
```

---

### 5.8 `ProgressStats` Object (full shape)

```ts
interface ProgressStats {
  totalFiles: number;           // Total files across all statuses
  completedFiles: number;       // Files with status 'done'
  stagedFiles: number;          // Files with status 'staged'
  activeFiles: number;          // Files with status 'downloading'
  totalBytes: number;           // Total bytes across all files
  downloadedBytes: number;      // Bytes successfully downloaded
  overallProgress: number;      // 0–1 fraction (downloadedBytes / totalBytes)
  speedBytesPerSecond: number;  // Rolling 3-second average speed
  etaSeconds: number | null;    // Estimated seconds remaining (null if unknown)
  files: Map<string, FileEntry>; // All tracked files by ID
}
```

---

### 5.9 `FileEntry` Object (full shape)

```ts
interface FileEntry {
  id: string;                           // Unique ID (derived from URL + folder)
  url: string;                          // Remote URL
  filename: string;                     // Saved filename
  folder?: string;                      // Relative folder path
  totalBytes: number;                   // File size in bytes (0 until HEAD response)
  downloadedBytes: number;              // Bytes fetched so far
  status: FileStatus;                   // Current lifecycle state (see Section 4)
  addedAt: number;                      // Unix timestamp of when it was added
  errorMessage?: string;                // Populated when status === 'error'
  metadata?: Record<string, unknown>;   // User-supplied arbitrary data
}
```

---

### 5.10 Browser Capability Detection

```ts
import { getBrowserCapabilities, supportsOPFS, supportsFileSystemAccess } from '@khatiwadaprashant/zipit-core';

const caps = getBrowserCapabilities();
// caps.opfs: boolean              — OPFS / SyncAccessHandle available
// caps.fileSystemAccess: boolean  — showDirectoryPicker available
// caps.workers: boolean           — Web Workers available
// caps.serviceWorkers: boolean    — Service Workers available
// caps.streams: boolean           — ReadableStream available
```

**Use this to determine the output mode dynamically:**
```ts
const caps = getBrowserCapabilities();
if (caps.fileSystemAccess) {
  await ds.start({ saveToFolder: true }); // Chrome/Edge: native folder save
} else {
  await ds.zip('archive.zip');            // Firefox/Safari: ZIP fallback
}
```

---

### 5.11 Utility Exports

```ts
import { formatBytes, formatEta } from '@khatiwadaprashant/zipit-core';

formatBytes(1048576);  // → '1.0 MB'
formatEta(90);         // → '1m 30s'
```

---

## 6. React API (`@khatiwadaprashant/zipit-react`)

### 6.1 Exports

```ts
import { useZipIt, useZip } from '@khatiwadaprashant/zipit-react';
import type { UseZipItReturn, UseZipItOptions, UseZipReturn } from '@khatiwadaprashant/zipit-react';
```

---

### 6.2 `useZipIt` — Full Download Manager Hook

The primary hook. Creates and manages a `ZipItInstance` for the lifetime of the component.

```ts
const result = useZipIt(options?: UseZipItOptions): UseZipItReturn
```

`UseZipItOptions` is identical to `ZipItOptions` from core (see Section 5.1).

#### Return Value (`UseZipItReturn`)

| Property | Type | Description |
|:---|:---|:---|
| `add` | `(url, opts?) => FileEntry` | Add a single file to the queue |
| `addAll` | `(urls, opts?) => FileEntry[]` | Add multiple files |
| `start` | `(opts?) => Promise<void>` | Start all downloads |
| `pause` | `() => void` | Pause active downloads |
| `resume` | `() => void` | Resume paused downloads |
| `cancel` | `() => void` | Cancel all and clear queue |
| `zip` | `(filename?) => Promise<void>` | Stream-zip all files to disk |
| `saveToFolder` | `() => Promise<void>` | Folder picker + save (FSA API) |
| `hydrate` | `() => Promise<FileEntry[]>` | Restore previous session |
| `reset` | `() => Promise<void>` | Clear all state and OPFS cache |
| `progress` | `ProgressStats` | Live reactive progress object |
| `files` | `Map<string, FileEntry>` | Live reactive file map |
| `isPaused` | `boolean` | Whether downloads are paused |
| `isBusy` | `boolean` | Whether a process is running |
| `instance` | `ZipItInstance` | Escape hatch to raw core instance |

---

### 6.3 Complete `useZipIt` Usage Pattern

```tsx
import { useEffect } from 'react';
import { useZipIt } from '@khatiwadaprashant/zipit-react';
import { getBrowserCapabilities, formatBytes, formatEta } from '@khatiwadaprashant/zipit-core';

const caps = getBrowserCapabilities();

function DownloadManager({ fileList }: { fileList: Array<{ url: string; folder: string }> }) {
  const {
    add, start, pause, resume, cancel, zip, reset, hydrate,
    progress, files, isBusy, isPaused,
  } = useZipIt({
    concurrency: 4,
    onError: (err, file) => console.error(`Failed: ${file.filename}`, err),
    onComplete: () => console.log('All done!'),
  });

  // Restore any interrupted session on mount
  useEffect(() => {
    hydrate().then((interrupted) => {
      if (interrupted.length > 0) {
        // Optionally: show a "Resume previous download?" UI
      }
    });
  }, [hydrate]);

  const handleStart = () => {
    fileList.forEach(({ url, folder }) => add(url, { folder }));
    if (caps.fileSystemAccess) {
      start({ saveToFolder: true });
    } else {
      zip('my-files.zip'); // Firefox / Safari fallback
    }
  };

  const fileArray = Array.from(files.values());
  const pct = Math.round(progress.overallProgress * 100);
  const speed = formatBytes(progress.speedBytesPerSecond) + '/s';
  const eta = progress.etaSeconds != null ? formatEta(progress.etaSeconds) : '--';

  return (
    <div>
      {/* Global progress */}
      <div style={{ width: `${pct}%`, height: 4, background: 'green' }} />
      <p>{pct}% — {speed} — ETA: {eta}</p>
      <p>{progress.completedFiles} / {progress.totalFiles} files done</p>

      {/* Controls */}
      <button onClick={handleStart}  disabled={isBusy}>Start</button>
      <button onClick={pause}        disabled={!isBusy || isPaused}>Pause</button>
      <button onClick={resume}       disabled={!isPaused}>Resume</button>
      <button onClick={cancel}>Cancel</button>
      <button onClick={reset}>Reset</button>

      {/* Per-file list */}
      <ul>
        {fileArray.map((file) => (
          <li key={file.id}>
            <span>{file.filename}</span>
            <span>{file.status}</span>
            <span>{Math.round((file.downloadedBytes / (file.totalBytes || 1)) * 100)}%</span>
            {file.errorMessage && <span style={{ color: 'red' }}>{file.errorMessage}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

### 6.4 `useZip` — Lightweight One-Shot ZIP Hook

Use this when you **only** need a "Download as ZIP" button and don't need the full download manager.

```ts
const { zip, isZipping, progress, error } = useZip(): UseZipReturn
```

#### Parameters for `zip()`

| Param | Type | Description |
|:---|:---|:---|
| `urls` | `string[]` | Array of remote URLs to include in the archive |
| `filename` | `string` | Output `.zip` filename (default: `'archive.zip'`) |
| `folderMap` | `Map<string, string>` | Optional: maps each URL to its folder path for directory structure |

#### Return Value

| Property | Type | Description |
|:---|:---|:---|
| `zip` | `async (urls, filename?, folderMap?) => void` | Trigger the zip operation |
| `isZipping` | `boolean` | Whether a ZIP is in progress |
| `progress` | `number` | 0–1 estimate of completion |
| `error` | `Error \| null` | Error from the last failed zip attempt |

```tsx
import { useZip } from '@khatiwadaprashant/zipit-react';

function ZipButton({ urls }: { urls: string[] }) {
  const { zip, isZipping, progress, error } = useZip();

  // Optional: preserve folder structure
  const folderMap = new Map(urls.map((url) => [url, 'photos/2024']));

  return (
    <div>
      <button onClick={() => zip(urls, 'vacation.zip', folderMap)} disabled={isZipping}>
        {isZipping ? `Zipping… ${(progress * 100).toFixed(0)}%` : 'Download as ZIP'}
      </button>
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
    </div>
  );
}
```

---

## 7. Vanilla JS / TypeScript Pattern (no React)

```ts
import { createZipIt, getBrowserCapabilities } from '@khatiwadaprashant/zipit-core';

const caps = getBrowserCapabilities();
const ds = createZipIt({ concurrency: 4 });

// Subscribe to progress
const unsubscribe = ds.on('progress', (stats) => {
  document.getElementById('progress-bar').style.width = `${stats.overallProgress * 100}%`;
});

ds.on('complete', () => unsubscribe());

// Add files
ds.add('https://cdn.example.com/file1.jpg', { folder: 'photos' });
ds.add('https://cdn.example.com/file2.jpg', { folder: 'photos' });

// Output
if (caps.fileSystemAccess) {
  await ds.start({ saveToFolder: true });
} else {
  await ds.zip('archive.zip');
}
```

---

## 8. Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|:---|:---|:---|:---|
| Core download + ZIP | ✅ 102+ | ✅ 111+ | ✅ 15.4+ |
| OPFS staging | ✅ | ✅ | ✅ 16+ |
| Native folder save (`saveToFolder`) | ✅ | ❌ (use `zip()` fallback) | ❌ (use `zip()` fallback) |
| Resumable downloads (IndexedDB) | ✅ | ✅ | ✅ |

**Always call `getBrowserCapabilities()` to decide between `saveToFolder` and `zip()`.**

---

## 9. Critical Rules for Implementation

1. **`fflate` must be installed.** ZipIt will throw if it is missing. Always include it in `dependencies`, not `devDependencies`.

2. **`useZipIt` creates one instance per component mount.** Do not call it inside a loop or conditionally. Mount it at the page/feature level.

3. **`ds.zip()` does NOT require `ds.start()` first.** It fetches, compresses, and delivers the ZIP in one pipeline call.

4. **`ds.cancel()` does NOT clear OPFS.** Call `ds.reset()` if you want a full wipe. `cancel()` only stops in-flight network requests.

5. **`hydrate()` must be called on mount.** Without it, interrupted downloads from a previous session are invisible and inaccessible.

6. **`on()` returns an unsubscribe function.** In React, always capture it and call it in the `useEffect` cleanup. In vanilla JS, call it when tearing down the component.

7. **`saveToFolder` requires a user gesture.** The `showDirectoryPicker` browser API must be triggered from a button click, not programmatically on load.

8. **Multiple instances on the same origin need unique `dbName`.** If you use ZipIt in two places in the same app, pass different `dbName` values (e.g., `'zipit_gallery'`, `'zipit_exports'`).

---

## 10. Common Patterns

### Pattern A: Gallery Download with "Save to Folder OR ZIP" auto-detection

```tsx
const caps = getBrowserCapabilities();

const handleDownload = async () => {
  photos.forEach(p => add(p.url, { filename: p.name, folder: p.albumName }));
  if (caps.fileSystemAccess) {
    await start({ saveToFolder: true });
  } else {
    await zip('gallery.zip');
  }
};
```

### Pattern B: Resumable Download with Refresh Recovery

```tsx
useEffect(() => {
  hydrate().then((resumable) => {
    if (resumable.length > 0) {
      setShowResumePrompt(true);  // Show "Continue previous download?" UI
    }
  });
}, [hydrate]);

const handleResume = () => {
  setShowResumePrompt(false);
  start({ saveToFolder: true });
};

const handleDismiss = async () => {
  setShowResumePrompt(false);
  await reset();
};
```

### Pattern C: Simple ZIP Button (no manager needed)

```tsx
const { zip, isZipping } = useZip();
<button onClick={() => zip(urls, 'export.zip')} disabled={isZipping}>
  {isZipping ? 'Zipping…' : 'Export as ZIP'}
</button>
```

### Pattern D: Per-file error handling with retry

```tsx
const ds = useZipIt({
  onError: (err, file) => {
    // Standard UI pattern: retry automatically once, then show error
    if (file.retryCount < 2) {
      ds.retry(file.id);
    } else {
      showErrorToast(`Failed to download ${file.filename}`);
    }
  }
});
```

---

## 11. TypeScript: All Exported Types

```ts
// From @khatiwadaprashant/zipit-core
import type {
  ZipItOptions,        // Options for createZipIt()
  ZipItInstance,       // The object returned by createZipIt()
  AddFileOptions,      // Options for ds.add()
  FileEntry,           // A single file in the queue
  FileStatus,          // Union: 'idle' | 'queued' | 'downloading' | 'staged' | 'transferring' | 'done' | 'paused' | 'error'
  ProgressStats,       // The stats object emitted by 'progress' event
  ProgressHandler,     // (stats: ProgressStats) => void
  CompleteHandler,     // (stats: ProgressStats) => void
  ErrorHandler,        // (error: Error, file: FileEntry) => void
  FileProgressHandler, // (file: FileEntry) => void
  BrowserCapabilities, // Return type of getBrowserCapabilities()
} from '@khatiwadaprashant/zipit-core';

// From @khatiwadaprashant/zipit-react
import type {
  UseZipItOptions,   // Same as ZipItOptions
  UseZipItReturn,    // The full return type of useZipIt()
  UseZipReturn,      // The return type of useZip()
} from '@khatiwadaprashant/zipit-react';
```

---

## 12. Package Details

| Package | npm | Version |
|:---|:---|:---|
| Core | `@khatiwadaprashant/zipit-core` | `0.2.0` |
| React | `@khatiwadaprashant/zipit-react` | `0.2.0` |

- **License:** MIT
- **Repository:** https://github.com/Prashant8Khatiwada/zipit
- **Peer dependency:** `fflate ^0.8.0` (required)
- **Browser only** — no Node.js support
- **Tree-shakeable** — all exports are named and side-effect free
