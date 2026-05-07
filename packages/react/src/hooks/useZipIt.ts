import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  createZipIt,
  type ZipitConfig,
  type GlobalProgress,
  type FileDescriptor,
  type FileProgress,
  type SessionState,
  SessionStore,
  SessionRecovery,
} from '@khatiwadaprashant/zipit-core';

export interface UseZipItResult {
  // Actions
  addFiles: (files: FileDescriptor[]) => void;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  recover: (sessionId: string) => Promise<void>;

  // State
  sessionId: string | null;
  status: SessionState['status'];
  files: Map<string, FileProgress>;
  globalProgress: GlobalProgress | null;
  error: Error | null;
  isRecoverable: boolean;

  // Derived helpers
  isIdle: boolean;
  isRunning: boolean;
  isDone: boolean;
}

type ZipItAction =
  | { type: 'SET_SESSION'; sessionId: string; status: SessionState['status'] }
  | { type: 'SET_RECOVERABLE'; isRecoverable: boolean }
  | { type: 'ADD_FILES'; files: FileDescriptor[] }
  | { type: 'UPDATE_PROGRESS'; progress: GlobalProgress }
  | { type: 'UPDATE_FILE_PROGRESS'; progress: FileProgress }
  | { type: 'SET_STATUS'; status: SessionState['status'] }
  | { type: 'SET_ERROR'; error: Error | null }
  | { type: 'RESET' };

interface ZipItState {
  sessionId: string | null;
  status: SessionState['status'];
  files: Map<string, FileProgress>;
  globalProgress: GlobalProgress | null;
  error: Error | null;
  isRecoverable: boolean;
}

const initialState: ZipItState = {
  sessionId: null,
  status: 'idle',
  files: new Map(),
  globalProgress: null,
  error: null,
  isRecoverable: false,
};

function zipItReducer(state: ZipItState, action: ZipItAction): ZipItState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, sessionId: action.sessionId, status: action.status };
    case 'SET_RECOVERABLE':
      return { ...state, isRecoverable: action.isRecoverable };
    case 'ADD_FILES': {
      const newFiles = new Map(state.files);
      action.files.forEach((f) => {
        if (!newFiles.has(f.id)) {
          newFiles.set(f.id, {
            fileId: f.id,
            phase: 'pending',
            downloadedBytes: 0,
            totalBytes: f.sizeBytes,
          });
        }
      });
      return { ...state, files: newFiles };
    }
    case 'UPDATE_PROGRESS':
      return { ...state, globalProgress: action.progress };
    case 'UPDATE_FILE_PROGRESS': {
      const newFiles = new Map(state.files);
      newFiles.set(action.progress.fileId, action.progress);
      return { ...state, files: newFiles };
    }
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_ERROR':
      return { ...state, error: action.error, status: action.error ? 'error' : state.status };
    case 'RESET':
      return { ...initialState, isRecoverable: state.isRecoverable };
    default:
      return state;
  }
}

/**
 * useZipIt — primary React hook for batch downloading and client-side zipping.
 *
 * Implements the Phase 4.1 specification:
 * - useReducer for internal state
 * - Session recovery via IndexedDB
 * - Native File System Access API integration
 */
export function useZipIt(config: Partial<ZipitConfig> = {}): UseZipItResult {
  const [state, dispatch] = useReducer(zipItReducer, initialState);
  const configRef = useRef(config);
  configRef.current = config;

  // Internal ZipIt instance - kept in a ref, never exposed
  const instanceRef = useRef<ReturnType<typeof createZipIt> | null>(null);

  const getInstance = useCallback(() => {
    if (!instanceRef.current) {
      instanceRef.current = createZipIt(configRef.current);
    }
    return instanceRef.current;
  }, []);

  // ─── Side Effects ──────────────────────────────────────────────────────────

  // Check for recoverable sessions on mount
  useEffect(() => {
    async function checkRecovery() {
      try {
        const store = await SessionStore.open();
        const recovery = new SessionRecovery(store, {} as any); // opfsStore not needed for find
        const interrupted = await recovery.findInterruptedSessions();
        dispatch({ type: 'SET_RECOVERABLE', isRecoverable: interrupted.length > 0 });
        store.close();
      } catch (err) {
        console.error('[ZipIt] Failed to check recovery:', err);
      }
    }
    checkRecovery();
  }, []);

  // Wire up instance events
  useEffect(() => {
    const instance = getInstance();

    const unsubProgress = instance.on('progress', (progress: GlobalProgress) => {
      dispatch({ type: 'UPDATE_PROGRESS', progress });
      if (progress.phase === 'done') {
        dispatch({ type: 'SET_STATUS', status: 'done' });
      }
    });

    const unsubFileProgress = instance.on('file-progress', (progress: FileProgress) => {
      dispatch({ type: 'UPDATE_FILE_PROGRESS', progress });
    });

    const unsubError = instance.on('error', (error: Error) => {
      dispatch({ type: 'SET_ERROR', error });
    });

    return () => {
      unsubProgress();
      unsubFileProgress();
      unsubError();
    };
  }, [getInstance]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileDescriptor[]) => {
    const instance = getInstance();
    files.forEach(f => {
      instance.add(f.url, {
        filename: f.path.split('/').pop(),
        folder: f.path.split('/').slice(0, -1).join('/'),
        sizeBytes: f.sizeBytes,
        metadata: f.metadata,
      });
    });
    dispatch({ type: 'ADD_FILES', files });
  }, [getInstance]);

  const start = useCallback(async () => {
    const instance = getInstance();
    try {
      dispatch({ type: 'SET_STATUS', status: 'running' });
      await instance.start({ saveToFolder: true });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err as Error });
    }
  }, [getInstance]);

  const pause = useCallback(() => {
    getInstance().pause();
    dispatch({ type: 'SET_STATUS', status: 'paused' });
  }, [getInstance]);

  const resume = useCallback(() => {
    getInstance().resume();
    dispatch({ type: 'SET_STATUS', status: 'running' });
  }, [getInstance]);

  const cancel = useCallback(() => {
    getInstance().cancel();
    dispatch({ type: 'RESET' });
  }, [getInstance]);

  const recover = useCallback(async (sessionId: string) => {
    const instance = getInstance();
    try {
      // In a real implementation, we'd need to tell the instance to load this session.
      // Currently, hydrate() loads the latest. We might need to update core to support sessionId.
      await instance.hydrate();
      dispatch({ type: 'SET_SESSION', sessionId, status: 'paused' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err as Error });
    }
  }, [getInstance]);

  return {
    ...state,
    addFiles,
    start,
    pause,
    resume,
    cancel,
    recover,
    isIdle: state.status === 'idle',
    isRunning: state.status === 'running',
    isDone: state.status === 'done',
  };
}
