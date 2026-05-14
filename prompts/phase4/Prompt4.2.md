In packages/react/src/components/, implement these headless (logic-only, zero styling) UI components using the Compound Component + Render Props pattern.

Components:

1. <ZipItProvider config={...}>
   React Context provider. Calls useZipIt internally.
   All child components consume context via useZipItContext().

2. <ZipIt.DropZone onFiles={(files: File[]) => void}>
   Wraps children. Handles drag-and-drop file events.
   Calls onFiles with the dropped File[] array.
   Exposes isDragging via render prop.
   
   Usage: <ZipIt.DropZone>{({ isDragging }) => <div className={isDragging ? 'highlight' : ''}/>}</ZipIt.DropZone>

3. <ZipIt.FileList>
   Renders nothing itself. Provides files array via render prop.
   Usage: <ZipIt.FileList>{(files) => files.map(f => ...)}</ZipIt.FileList>

4. <ZipIt.GlobalProgress>
   Render prop: { percent, speedMBps, etaSeconds, phase }
   
5. <ZipIt.StartButton>
   Calls start() on click. Render prop: { onClick, disabled, status }

6. <ZipIt.PauseResumeButton>
   Render prop: { onClick, disabled, isPaused }

7. <ZipIt.RecoveryBanner>
   Renders only if isRecoverable is true.
   Render prop: { sessionIds, onRecover }

Requirements:
- 100% headless — no className, no style props, no CSS imports
- Each component is in its own file
- Barrel export from packages/react/src/index.ts
- Full TypeScript generics where appropriate
- Storybook stories (stories/) for each component using the default decorator