# React Hooks

The `@khatiwadaprashant/zipit-react` package provides a reactive wrapper around the core engine, making it easy to build complex download UIs with minimal boilerplate.

## `useZipIt`

The primary hook for managing a download queue.

```tsx
import { useZipIt } from '@khatiwadaprashant/zipit-react'

function App() {
  const { 
    files,      // Array of active/queued files
    progress,   // { overallProgress, totalBytes, speed, eta }
    isBusy,     // Boolean: active download or zip operation
    add,        // Function to add a file
    addAll,     // Function to add multiple files (async)
    start,      // Start processing
    zip,        // Finalize as ZIP
    pause,
    resume,
    cancel 
  } = useZipIt({
    concurrency: 4,
    onComplete: (stats) => console.log('Done!', stats)
  })

  // ... render UI
}
```

## `useZip`

A lightweight hook if you only need on-the-fly zipping without the full queue management.

```tsx
import { useZip } from '@khatiwadaprashant/zipit-react'

function SimpleZip() {
  const { zip, progress, isZipping } = useZip()

  const handleClick = () => {
    zip('photos.zip', [
      'https://example.com/1.jpg',
      'https://example.com/2.jpg'
    ])
  }

  return <button onClick={handleClick}>Download Zip</button>
}
```

## Best Practices

### Stable Callbacks
The hooks use internal refs to ensure that your callbacks (`onProgress`, `onComplete`, etc.) don't cause the engine to re-initialize if they are defined inline. However, for clean code, it is recommended to wrap them in `useCallback`.

### Concurrent Operations
Avoid calling `zip()` while a `start()` operation is already in the "transferring" phase, as this might lead to resource contention in the OPFS. The `isBusy` flag is your best friend for disabling UI buttons during active operations.
