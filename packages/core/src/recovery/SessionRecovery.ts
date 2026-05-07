import DownloadOrchestrator from '../DownloadOrchestrator';
import OpfsStore from '../storage/OpfsStore';
import SessionStore from '../storage/SessionStore';
import type { FileDescriptor, SessionState, ZipitConfig } from '../types';

/** A concrete plan for continuing or retrying an interrupted session. */
export interface RecoveryPlan {
  sessionId: string;
  filesToResume: Array<{ file: FileDescriptor; resumeFromByte: number }>;
  filesToRetry: FileDescriptor[];
  completedFileIds: string[];
}

/** Reconstructs ZipIt download sessions after reloads or interruptions. */
export class SessionRecovery {
  /**
   * Creates a session recovery helper.
   *
   * @param sessionStore - IndexedDB-backed session storage.
   * @param opfsStore - OPFS-backed partial file storage.
   */
  constructor(
    private readonly sessionStore: SessionStore,
    private readonly opfsStore: OpfsStore
  ) {}

  /**
   * Finds sessions that were running or paused when the page stopped.
   *
   * @returns Interrupted sessions.
   */
  async findInterruptedSessions(): Promise<SessionState[]> {
    const sessions = await this.sessionStore.listSessions();
    return sessions.filter((session) => session.status === 'running' || session.status === 'paused');
  }

  /**
   * Builds a recovery plan for a persisted session.
   *
   * @param sessionId - Session id to recover.
   * @returns Recovery plan with completed, resumable, and retryable files.
   */
  async recoverSession(sessionId: string): Promise<RecoveryPlan> {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const progressByFileId = new Map(
      (await this.sessionStore.getFileProgress(sessionId)).map((progress) => [
        progress.fileId,
        progress,
      ])
    );
    const plan: RecoveryPlan = {
      sessionId,
      filesToResume: [],
      filesToRetry: [],
      completedFileIds: [],
    };

    for (const file of session.files) {
      const progress = progressByFileId.get(file.id);

      if (progress?.phase === 'done') {
        plan.completedFileIds.push(file.id);
        continue;
      }

      if (progress?.phase === 'error') {
        plan.filesToRetry.push(file);
        continue;
      }

      const resumeFromByte = await this.opfsStore.getDownloadedBytes(file.id);
      if (resumeFromByte > 0) {
        plan.filesToResume.push({ file, resumeFromByte });
      } else {
        plan.filesToRetry.push(file);
      }
    }

    return plan;
  }

  /**
   * Applies a recovery plan to an orchestrator.
   *
   * The orchestrator computes start offsets from OPFS during enqueue, so files
   * with non-zero partial bytes resume from their existing `.partial` size.
   *
   * @param plan - Recovery plan to apply.
   * @param orchestrator - Orchestrator that should receive queued files.
   */
  async applyRecoveryPlan(
    plan: RecoveryPlan,
    orchestrator: DownloadOrchestrator
  ): Promise<void> {
    await orchestrator.enqueue([
      ...plan.filesToResume.map((entry) => entry.file),
      ...plan.filesToRetry,
    ]);
  }
}

/**
 * Opens storage and either recovers an existing session or creates a new one.
 *
 * @param sessionIdOrFiles - Existing session id, or fresh files to enqueue.
 * @param config - Download configuration.
 * @returns An orchestrator and a flag describing whether recovery occurred.
 */
export async function recoverOrCreate(
  sessionIdOrFiles: string | FileDescriptor[],
  config: ZipitConfig
): Promise<{ orchestrator: DownloadOrchestrator; isRecovered: boolean }> {
  const sessionId =
    typeof sessionIdOrFiles === 'string' ? sessionIdOrFiles : createSessionId();
  const sessionStore = await SessionStore.open();
  const opfsStore = await OpfsStore.open(sessionId);
  const orchestrator = new DownloadOrchestrator(config, sessionStore, opfsStore);

  if (typeof sessionIdOrFiles === 'string') {
    const recovery = new SessionRecovery(sessionStore, opfsStore);
    const session = await sessionStore.getSession(sessionIdOrFiles);
    if (session) {
      const plan = await recovery.recoverSession(sessionIdOrFiles);
      await recovery.applyRecoveryPlan(plan, orchestrator);
      return { orchestrator, isRecovered: true };
    }
    return { orchestrator, isRecovered: false };
  }

  await orchestrator.enqueue(sessionIdOrFiles);
  return { orchestrator, isRecovered: false };
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default SessionRecovery;
