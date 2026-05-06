Set up apps/docs/ as an Astro + Starlight documentation site.

Pages to create:

1. Getting Started
   - Installation (npm install zipit-core zipit-react)
   - Quick Start (10-line example)
   - Browser Requirements table (with compat matrix)

2. Core API Reference
   - Auto-generate from TSDoc comments in packages/core using typedoc-plugin-markdown
   - All public classes and functions

3. React API Reference
   - useZipIt hook props and return values
   - All headless components with prop tables

4. Guides
   - "Handling Large Files (>4GB)"
   - "Using Without React (Vanilla JS)"
   - "Custom Progress UI"
   - "Error Handling & Retries"

5. Architecture Deep Dive
   - Threading model diagram (Mermaid)
   - OPFS layout diagram
   - ZIP streaming pipeline diagram

Configure Starlight with:
- Dark theme matching the main app
- Search enabled
- GitHub edit links pointing to the monorepo
- Auto-generated sidebar from the pages structure