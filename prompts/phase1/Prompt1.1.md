In packages/core/src/storage/SessionStore.ts, implement a class SessionStore using raw IndexedDB (no wrapper libraries).

Schema — database name: "zipit-v1", version: 1
- Object store: "sessions"  — keyPath: "sessionId"
- Object store: "fileProgress"  — keyPath: "fileId", index on "sessionId"

Implement these async methods:

1. static open(): Promise<SessionStore>
   Opens (or creates) the database. Returns a connected instance.

2. saveSession(state: SessionState): Promise<void>
   Upserts a session record.

3. getSession(sessionId: string): Promise<SessionState | null>

4. listSessions(): Promise<SessionState[]>
   Returns all sessions sorted by createdAt descending.

5. deleteSession(sessionId: string): Promise<void>
   Deletes session AND all its fileProgress records in a single transaction.

6. saveFileProgress(progress: FileProgress): Promise<void>
   Upserts file progress. Stores the fileId → sessionId mapping.

7. getFileProgress(sessionId: string): Promise<FileProgress[]>
   Retrieves all FileProgress records for a session.

8. close(): void

Requirements:
- All operations use proper IDBTransaction with error handling
- Wrap IDB request callbacks in Promises cleanly (no raw onsuccess/onerror leaks)
- TypeScript strict — no `any`
- Full JSDoc on all public methods
- Export the class as default

Include a simple test file at packages/core/src/__tests__/SessionStore.test.ts using Vitest + fake-indexeddb.