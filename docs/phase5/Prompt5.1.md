In apps/web/, set up a Vite + React + TypeScript SPA for the zipit SaaS product.

Requirements:
- React Router v6 with routes: / (landing), /app (downloader), /docs (redirect to apps/docs)
- Tailwind CSS v4 configured
- Framer Motion installed
- packages/core and packages/react wired as workspace dependencies
- Basic layout: Header with logo + nav, main content area, footer
- Import ZipItUI on the /app route with a file URL input form above it
  (input accepts comma-separated URLs or paste a list)
- The URL input should parse each URL into a FileDescriptor
  (derive path from URL pathname, sizeBytes: undefined initially)
- On "Start ZIP Download" button: call addFiles() then start()

Keep the /app page functional but unstyled beyond the ZipItUI component — styling comes in 5.2.