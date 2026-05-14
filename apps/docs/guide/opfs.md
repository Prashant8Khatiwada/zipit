# OPFS Staging

The **Origin Private File System (OPFS)** is a specialized storage area provided by modern browsers that allows for high-performance, asynchronous file access. ZipIt uses OPFS as a staging area to ensure that downloads are resumable and extremely fast.

## Why OPFS?

Traditional browser storage (like LocalStorage or even standard Blob URLs) is not suitable for multi-gigabyte file handling. Blobs are often stored in RAM, and standard filesystem access is too slow for high-concurrency downloads.

OPFS provides:
1. **Low-Latency Access**: Near-native disk speeds.
2. **Persistence**: Files stay on disk until explicitly deleted, even if the user refreshes the page.
3. **Worker Support**: OPFS can be accessed directly from Web Workers, which is where ZipIt does all its heavy lifting.

## Session Hydration

Because files are staged in OPFS, ZipIt can "remember" a download batch across page reloads. This is called **Hydration**.

```typescript
// On page load
const pending = await ds.hydrate();

if (pending.length > 0) {
  // Found partially downloaded files!
  // ds.start() will now resume from the exact byte where it left off.
  ds.start();
}
```

## Storage Limits

While OPFS is powerful, it is still subject to the browser's storage quota (usually 50% of available disk space). You can monitor this using the ZipIt API:

```typescript
const { quota, usage } = await ds.getStorageEstimate();
console.log(`Using ${usage} bytes out of ${quota}`);
```

If the storage is full, ZipIt will throw a `QUOTA_EXCEEDED` error, which you can catch in your `onError` handler.
