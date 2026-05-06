In packages/react/src/hooks/useZipIt.ts, implement the primary React hook.

Interface:

function useZipIt(config?: Partial<ZipitConfig>): UseZipItResult

interface UseZipItResult {
  // Actions
  addFiles: (files: FileDescriptor[]) => void
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  cancel: () => void
  recover: (sessionId: string) => Promise<void>

  // State
  sessionId: string | null
  status: SessionState['status']
  files: Map<string, FileProgress>
  globalProgress: GlobalProgress | null
  error: Error | null
  isRecoverable: boolean  // true if interrupted sessions exist in IndexedDB

  // Derived helpers
  isIdle: boolean
  isRunning: boolean
  isDone: boolean
}

Implementation requirements:
- Use useReducer internally for all state
- Never expose internal class instances directly to consumers
- start() shows the native Save File dialog, then begins downloads + ZIP pipeline
- Session state is automatically persisted to IndexedDB on every progress update (debounced 500ms)
- On mount, automatically check for recoverable sessions and set isRecoverable
- Stable function references (useCallback) for all actions
- React 18 compatible — use startTransition for non-urgent progress updates
- TypeScript strict — no `any`

Include a simple test using @testing-library/react-hooks (or renderHook) that:
- Mocks the core engine
- Verifies state transitions from idle → running → done