---
title: Installation
---

Install the library using your preferred package manager:

### Core Library (Framework Agnostic)

```bash
npm install @zipit/core
```

### React Hooks & Components

```bash
npm install @zipit/react @zipit/core
```

## Browser Requirements

ZipIt relies on modern browser APIs for streaming and file handling.

| Feature | Requirement | Fallback |
| :--- | :--- | :--- |
| **OPFS** | Chrome 102+, Edge 102+, Safari 17+ | In-memory storage |
| **File System Access API** | Chrome 86+, Edge 86+ | Manual ZIP download |
| **Web Workers** | All modern browsers | (Required) |
| **Readable Streams** | All modern browsers | (Required) |
