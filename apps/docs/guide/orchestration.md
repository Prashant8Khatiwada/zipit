# Download Orchestration

ZipIt uses a sophisticated orchestration layer to manage multiple concurrent downloads without blocking the UI thread or exceeding browser resource limits.

## The Worker Pool

When you call `ds.start()`, ZipIt initializes a pool of Web Workers. Each worker is responsible for fetching a single file in chunks and writing it to the **Origin Private File System (OPFS)**.

- **Concurrency Control**: You can configure the number of parallel downloads via the `concurrency` option.
- **Backpressure**: If the disk write speed is slower than the network speed, the engine automatically throttles the network fetch to prevent memory overflow.

## File Lifecycle

Every file added to ZipIt goes through a structured state machine:

1.  **`queued`**: Added to the list but not yet started.
2.  **`downloading`**: Active network fetch in progress.
3.  **`staged`**: Completely downloaded and stored in OPFS.
4.  **`transferring`**: Moving from OPFS to the user's local disk (if using File System Access API).
5.  **`done`**: Successfully processed.
6.  **`error`**: Something went wrong (network failure, disk full, etc.).

## Progress Tracking

ZipIt provides real-time, granular progress updates. Instead of recalculating the entire state on every byte, it uses a high-performance delta-based accumulator to calculate:

- **Overall Progress**: A percentage (0.0 to 1.0) of the total batch.
- **Transfer Speed**: Rolling average in bytes per second.
- **ETA**: Estimated time remaining based on current speed.

```typescript
ds.on('progress', (stats) => {
  console.log(`Current Speed: ${stats.speedBytesPerSecond / 1024 / 1024} MB/s`);
});
```
