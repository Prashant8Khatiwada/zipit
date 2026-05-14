# ZIP Streaming

ZipIt's most powerful feature is its ability to generate standard ZIP archives on-the-fly as data flows from the network to the disk.

## How it Works

Traditional ZIP libraries require you to have all files fully downloaded before bundling them. This leads to massive RAM spikes and crashes on large batches.

ZipIt uses **Streaming Compression**:

1.  **Chunked Processing**: As a file is being downloaded (or pulled from OPFS staging), it is read in small chunks (usually 1MB).
2.  **On-the-fly Compression**: Each chunk is passed through a compression stream (using `fflate`).
3.  **Direct Delivery**: The compressed bytes are immediately written to the user's disk via a `ReadableStream` and the File System Access API.

## Parallel vs. Serial

When you call `ds.zip()`, ZipIt intelligently balances parallel downloading and serial zipping:

- **Parallel Staging**: Files are downloaded in parallel (up to your `concurrency` limit) to OPFS.
- **Serial Streaming**: Once a file is partially or fully staged, it is piped into the ZIP stream sequentially. This ensures the ZIP file remains valid and the memory usage stays low (constant ~5MB).

## Example: Massive Archive

```typescript
// Even with 1000 photos, this command will only use a few megabytes of RAM.
await ds.zip('photos_2024.zip');
```

## Performance Tips

For the fastest ZIP generation:
- Use a **high concurrency** (4-6) to saturate your network during the staging phase.
- Use **uncompressed** source files if possible; re-compressing already compressed files (like JPEGs) into a ZIP is primarily for organization, not size reduction.
