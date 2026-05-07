import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import SessionStore from '../storage/SessionStore';
import type { FileProgress, SessionState } from '../types';

const session: SessionState = {
  sessionId: 'session-1',
  files: [
    {
      id: 'file-1',
      url: 'https://example.com/a.txt',
      path: 'a.txt',
      sizeBytes: 8,
    },
  ],
  status: 'idle',
  createdAt: 200,
};

describe('SessionStore', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new IDBFactory(),
      configurable: true,
    });
  });

  it('saves and loads a session', async () => {
    const store = await SessionStore.open();
    await store.saveSession(session);

    await expect(store.getSession('session-1')).resolves.toEqual(session);
    await expect(store.getSession('missing')).resolves.toBeNull();
    store.close();
  });

  it('lists sessions newest first', async () => {
    const store = await SessionStore.open();
    await store.saveSession({ ...session, sessionId: 'old', createdAt: 100 });
    await store.saveSession({ ...session, sessionId: 'new', createdAt: 300 });

    const sessions = await store.listSessions();

    expect(sessions.map((item) => item.sessionId)).toEqual(['new', 'old']);
    store.close();
  });

  it('saves and retrieves file progress for a session', async () => {
    const store = await SessionStore.open();
    const progress: FileProgress = {
      fileId: 'file-1',
      phase: 'downloading',
      downloadedBytes: 4,
      totalBytes: 8,
    };

    await store.saveSession(session);
    await store.saveFileProgress(progress);

    await expect(store.getFileProgress('session-1')).resolves.toEqual([progress]);
    store.close();
  });

  it('deletes a session and its progress records in one operation', async () => {
    const store = await SessionStore.open();
    await store.saveSession(session);
    await store.saveFileProgress({
      fileId: 'file-1',
      phase: 'done',
      downloadedBytes: 8,
      totalBytes: 8,
    });

    await store.deleteSession('session-1');

    await expect(store.getSession('session-1')).resolves.toBeNull();
    await expect(store.getFileProgress('session-1')).resolves.toEqual([]);
    store.close();
  });
});
