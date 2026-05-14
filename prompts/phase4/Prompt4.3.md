In packages/react/src/components/ZipItUI.tsx, build a fully-styled, production-ready default UI component that uses all the headless components above.

Design requirements:
- Dark theme: background #0A0A0F, accent #00E5FF (electric cyan), text #E8E8F0
- Monospace font for speeds and progress numbers (JetBrains Mono or similar)
- Drag-and-drop zone with animated dashed border on hover
- File list with per-file progress bars (phase-colored: pending=gray, downloading=cyan, zipping=green)
- Global progress bar with animated shimmer effect during download
- Speed in MB/s and ETA displayed as pills
- Recovery banner: subtle amber warning at the top
- Smooth transitions between states using CSS transitions
- Fully responsive: works at 320px width and up

Use only CSS Modules (ZipItUI.module.css) — no external CSS framework.

Props:
  interface ZipItUIProps {
    config?: Partial<ZipitConfig>
    className?: string
    zipName?: string
  }

The component must be a drop-in: import { ZipItUI } from 'zipit-react'; <ZipItUI zipName="my-files.zip" />

Include a Storybook story with a mock that simulates a realistic 3-file download over 10 seconds using setInterval.