# Browser Support

ZipIt relies on several modern Web APIs to achieve its performance. While most modern browsers are supported, some features degrade gracefully on older versions.

## Feature Compatibility Matrix

| Feature | Chrome / Edge | Firefox | Safari |
| :--- | :---: | :---: | :---: |
| **Origin Private File System (OPFS)** | ✅ 102+ | ✅ 111+ | ✅ 15.4+ |
| **Compression Streams** | ✅ 80+ | ✅ 113+ | ✅ 16.4+ |
| **File System Access API** | ✅ 86+ | ❌ (Fallback) | ❌ (Fallback) |
| **IndexedDB** | ✅ | ✅ | ✅ |

## Graceful Degradation

ZipIt is designed to work even when the most advanced APIs are missing:

### No File System Access API
In Firefox and Safari, where the native "Save to Folder" API is unavailable, ZipIt automatically falls back to generating a **Streaming ZIP**. The user receives a single file, and the library still uses OPFS to ensure the download is resumable.

### No OPFS
In extremely old browsers or restricted environments where OPFS is unavailable, ZipIt will attempt to buffer smaller files in memory, but performance and resumability will be limited. We recommend checking support at runtime:

```typescript
import { getBrowserCapabilities } from '@khatiwadaprashant/zipit-core';

const caps = getBrowserCapabilities();
if (!caps.opfs) {
  console.warn("Storage performance will be degraded.");
}
```

## Security Requirements

- **HTTPS**: Most of the APIs used (OPFS, Workers, File System Access) require a Secure Context (HTTPS or localhost).
- **CORS**: To download files from other domains, the server must provide appropriate `Access-Control-Allow-Origin` headers.
