import type { FileProgress, SessionState } from '../types';

const DB_NAME = 'zipit-v1';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const FILE_PROGRESS_STORE = 'fileProgress';
const SESSION_ID_INDEX = 'sessionId';

interface FileProgressRecord {
  fileId: string;
  sessionId: string;
  phase: FileProgress['phase'];
  downloadedBytes: number;
  totalBytes?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface FileProgressWithSessionId extends FileProgress {
  sessionId?: string;
}

/** IndexedDB-backed persistence for ZipIt sessions and per-file progress. */
export default class SessionStore {
  private constructor(private readonly db: IDBDatabase) {}

  /**
   * Opens the ZipIt IndexedDB database, creating stores and indexes when needed.
   *
   * @returns A connected SessionStore instance.
   */
  static async open(): Promise<SessionStore> {
    const db = await requestToPromise<IDBDatabase>(() => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'sessionId' });
        }
        if (!db.objectStoreNames.contains(FILE_PROGRESS_STORE)) {
          const store = db.createObjectStore(FILE_PROGRESS_STORE, { keyPath: 'fileId' });
          store.createIndex(SESSION_ID_INDEX, SESSION_ID_INDEX, { unique: false });
        }
      };

      return request;
    });

    return new SessionStore(db);
  }

  /**
   * Saves or replaces a session record.
   *
   * @param state - The session state to persist.
   */
  async saveSession(state: SessionState): Promise<void> {
    await this.withTransaction([SESSIONS_STORE], 'readwrite', (transaction) => {
      const store = transaction.objectStore(SESSIONS_STORE);
      store.put(state);
    });
  }

  /**
   * Retrieves a session by id.
   *
   * @param sessionId - The session id to load.
   * @returns The matching session or null when missing.
   */
  async getSession(sessionId: string): Promise<SessionState | null> {
    return this.withTransaction([SESSIONS_STORE], 'readonly', async (transaction) => {
      const store = transaction.objectStore(SESSIONS_STORE);
      const result = await requestToPromise<SessionState | undefined>(() => store.get(sessionId));
      return result ?? null;
    });
  }

  /**
   * Lists all saved sessions newest first.
   *
   * @returns All session records sorted by descending creation time.
   */
  async listSessions(): Promise<SessionState[]> {
    const sessions = await this.withTransaction([SESSIONS_STORE], 'readonly', async (transaction) => {
      const store = transaction.objectStore(SESSIONS_STORE);
      return requestToPromise<SessionState[]>(() => store.getAll());
    });
    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Deletes a session and every file progress record associated with it.
   *
   * @param sessionId - The session id to delete.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.withTransaction(
      [SESSIONS_STORE, FILE_PROGRESS_STORE],
      'readwrite',
      async (transaction) => {
        transaction.objectStore(SESSIONS_STORE).delete(sessionId);

        const fileStore = transaction.objectStore(FILE_PROGRESS_STORE);
        const index = fileStore.index(SESSION_ID_INDEX);
        const records = await requestToPromise<FileProgressRecord[]>(() => index.getAll(sessionId));
        for (const record of records) {
          fileStore.delete(record.fileId);
        }
      }
    );
  }

  /**
   * Saves per-file progress. The session id is resolved from an existing session
   * containing the file, or from a structural `sessionId` property when supplied.
   *
   * @param progress - The progress snapshot to persist.
   */
  async saveFileProgress(progress: FileProgress): Promise<void> {
    const sessionId =
      (progress as FileProgressWithSessionId).sessionId ??
      (await this.findSessionIdForFile(progress.fileId));

    if (!sessionId) {
      throw new Error(`Cannot save progress for unknown fileId: ${progress.fileId}`);
    }

    const record = toRecord(progress, sessionId);
    await this.withTransaction([FILE_PROGRESS_STORE], 'readwrite', (transaction) => {
      transaction.objectStore(FILE_PROGRESS_STORE).put(record);
    });
  }

  /**
   * Loads progress records for every file in a session.
   *
   * @param sessionId - The session id whose file progress should be returned.
   * @returns Progress snapshots for the session.
   */
  async getFileProgress(sessionId: string): Promise<FileProgress[]> {
    return this.withTransaction([FILE_PROGRESS_STORE], 'readonly', async (transaction) => {
      const index = transaction.objectStore(FILE_PROGRESS_STORE).index(SESSION_ID_INDEX);
      const records = await requestToPromise<FileProgressRecord[]>(() => index.getAll(sessionId));
      return records.map(fromRecord);
    });
  }

  /** Closes the underlying IndexedDB connection. */
  close(): void {
    this.db.close();
  }

  private async findSessionIdForFile(fileId: string): Promise<string | undefined> {
    const sessions = await this.listSessions();
    return sessions.find((session) => session.files.some((file) => file.id === fileId))?.sessionId;
  }

  private async withTransaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    callback: (transaction: IDBTransaction) => T | Promise<T>
  ): Promise<T> {
    const transaction = this.db.transaction(storeNames, mode);
    const done = transactionDone(transaction);
    try {
      const result = await callback(transaction);
      await done;
      return result;
    } catch (error) {
      if (transaction.error === null) {
        transaction.abort();
      }
      throw error;
    }
  }
}

function toRecord(progress: FileProgress, sessionId: string): FileProgressRecord {
  return {
    fileId: progress.fileId,
    sessionId,
    phase: progress.phase,
    downloadedBytes: progress.downloadedBytes,
    totalBytes: progress.totalBytes,
    error: progress.error
      ? {
          name: progress.error.name,
          message: progress.error.message,
          stack: progress.error.stack,
        }
      : undefined,
  };
}

function fromRecord(record: FileProgressRecord): FileProgress {
  return {
    fileId: record.fileId,
    phase: record.phase,
    downloadedBytes: record.downloadedBytes,
    totalBytes: record.totalBytes,
    error: record.error ? Object.assign(new Error(record.error.message), record.error) : undefined,
  };
}

function requestToPromise<T>(createRequest: () => IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = createRequest();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}
