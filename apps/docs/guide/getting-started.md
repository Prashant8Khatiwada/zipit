# Getting Started

ZipIt is a professional, high-performance batch download and ZIP streaming library for modern browsers. It allows you to download hundreds of files and bundle them into a single ZIP archive directly on the client side, with zero server load and minimal RAM usage.

## Installation

Install ZipIt core and its peer dependency `fflate`:

```bash
pnpm add @khatiwadaprashant/zipit-core fflate
```

If you are using React, also install the hooks package:

```bash
pnpm add @khatiwadaprashant/zipit-react
```

## Basic Usage (Core API)

```typescript
import { createZipIt } from '@khatiwadaprashant/zipit-core'

// 1. Initialize the manager
const ds = createZipIt({
  concurrency: 4, // Download 4 files at a time
  onProgress: (stats) => {
    console.log(`Progress: ${Math.round(stats.overallProgress * 100)}%`)
  }
})

// 2. Add files to the queue
ds.add('https://example.com/photo1.jpg', { filename: 'sunset.jpg' })
ds.add('https://example.com/photo2.jpg', { filename: 'beach.jpg' })

// 3. Stream-zip directly to user's disk
await ds.zip('my-photos.zip')
```

## React Usage

```tsx
import { useZipIt } from '@khatiwadaprashant/zipit-react'

function DownloadButton() {
  const { add, zip, progress, isBusy } = useZipIt()

  const handleDownload = async () => {
    add('https://example.com/file.pdf')
    await zip('archive.zip')
  }

  return (
    <button onClick={handleDownload} disabled={isBusy}>
      {isBusy ? 'Downloading...' : 'Download ZIP'}
    </button>
  )
}
```
