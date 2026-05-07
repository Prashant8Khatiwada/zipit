import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import SessionRecovery from '../SessionRecovery';
import OpfsStore, { InMemoryOpfsBackend } from '../../storage/OpfsStore';
import SessionStore from '../../storage/SessionStore';
import type { FileDescriptor, FileProgress, SessionState } from '../../types';

const files: FileDescriptor[] = [
  { id: 'done-file', url: 'https://example.com/done', path: 'done.bin', sizeBytes: 10 },
  { id: 'error-file', url: 'https://example.com/error', path: 'error.bin', sizeBytes: 20 },
  { id: 'partial-file', url: 'https://example.com/partial', path: 'partial.bin', sizeBytes: 30 },
  { id: 'empty-file', url: 'https://example.com/empty', path: 'empty.bin', sizeBytes: 40 },
];

const session: SessionState = {
  sessionId: 'session-1',
  files,
  status: 'paused',
  createdAt: 1,
};

describe('SessionRecovery', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new IDBFactory(),
      configurable: true,
    });
  });

  it('finds running and paused sessions', async () => {
    const sessionStore = await SessionStore.open();
    const recovery = new SessionRecovery(
      sessionStore,
      OpfsStore.fromBackend('session-1', new InMemoryOpfsBackend())
    );
    await sessionStore.saveSession(session);
    await sessionStore.saveSession({ ...session, sessionId: 'done-session', status: 'done' });

    const interrupted = await recovery.findInterruptedSessions();

    expect(interrupted.map((item) => item.sessionId)).toEqual(['session-1']);
  });

  it('recovers done, error, partial, and empty states', async () => {
    const sessionStore = await SessionStore.open();
    const opfsStore = OpfsStore.fromBackend('session-1', new InMemoryOpfsBackend());
    const recovery = new SessionRecovery(sessionStore, opfsStore);

    await sessionStore.saveSession(session);
    await saveProgress(sessionStore, {
      fileId: 'done-file',
      phase: 'done',
      downloadedBytes: 10,
      totalBytes: 10,
    });
    await saveProgress(sessionStore, {
      fileId: 'error-file',
      phase: 'error',
      downloadedBytes: 5,
      totalBytes: 20,
      error: new Error('failed'),
    });
    await saveProgress(sessionStore, {
      fileId: 'partial-file',
      phase: 'downloading',
      downloadedBytes: 12,
      totalBytes: 30,
    });
    await opfsStore.writeChunk('partial-file', 0, new Uint8Array(12));

    const plan = await recovery.recoverSession('session-1');

    expect(plan.completedFileIds).toEqual(['done-file']);
    expect(plan.filesToResume).toEqual([{ file: files[2], resumeFromByte: 12 }]);
    expect(plan.filesToRetry).toEqual([files[1], files[3]]);
  });
});

async function saveProgress(store: SessionStore, progress: FileProgress): Promise<void> {
  await store.saveFileProgress(progress);
}
