# What is ZipIt?

ZipIt is a high-performance, framework-agnostic JavaScript library designed to handle complex batch download and file bundling tasks entirely on the client side.

## The Problem

Most web applications handle multiple file downloads in one of two ways:
1. **The "Waterfall"**: Triggering multiple individual downloads, which clutters the user's download bar and is often blocked by browser security.
2. **Server-Side Zipping**: Bundling files on the server. This is expensive (CPU/RAM intensive), slow (the user waits for the server to finish before downloading starts), and doesn't scale well.

## The ZipIt Solution

ZipIt moves the orchestration and compression to the **browser**. It uses modern web standards to provide a desktop-class experience:

- **Streaming Architecture**: It fetches files in chunks and feeds them into a compression stream. This means you can zip a 10GB folder with only 5MB of active RAM.
- **OPFS Staging**: Files are staged in the **Origin Private File System**. This allows the library to survive page refreshes—if the browser crashes or the user reloads, the download resumes exactly where it left off.
- **Multithreading**: ZipIt spawns a pool of Web Workers to fetch and process files in parallel, ensuring the main UI thread stays buttery smooth.
- **Native Folder Support**: On browsers supporting the File System Access API, ZipIt can recreate the entire folder structure directly on the user's local disk without even needing a ZIP file.

## Key Features

- ✅ **Resumable Downloads**: Byte-level persistence via IndexedDB.
- ✅ **Zero-RAM Compression**: Constant memory footprint regardless of file size.
- ✅ **Backpressure Handling**: Intelligently balances network speed vs. disk write speed.
- ✅ **Clean API**: Minimalist TypeScript-first API for both Vanilla JS and React.
