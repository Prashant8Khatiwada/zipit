In packages/core/src/recovery/SessionRecovery.ts, implement the logic that reconstructs a download session after a page reload.

Class: SessionRecovery

Constructor: (sessionStore: SessionStore, opfsStore: OpfsStore)

Methods:

1. async findInterruptedSessions(): Promise<SessionState[]>
   Returns all sessions from IndexedDB where status is 'running' or 'paused'.

2. async recoverSession(sessionId: string): Promise<RecoveryPlan>
   Builds a RecoveryPlan:
   
   interface RecoveryPlan {
     sessionId: string
     filesToResume: Array<{ file: FileDescriptor; resumeFromByte: number }>
     filesToRetry: FileDescriptor[]   // errored files that can be retried
     completedFileIds: string[]       // already in OPFS, skip download
   }
   
   Logic:
   - For each file in session:
     a. If phase === 'done': add to completedFileIds
     b. If phase === 'error': add to filesToRetry
     c. Otherwise: call opfsStore.getDownloadedBytes() to get resumeFromByte.
        If > 0: add to filesToResume. If 0: treat as filesToRetry.

3. async applyRecoveryPlan(plan: RecoveryPlan, orchestrator: DownloadOrchestrator): Promise<void>
   Re-enqueues filesToResume and filesToRetry into the orchestrator with correct startByte offsets.

Also implement a top-level convenience function:

async function recoverOrCreate(
  sessionIdOrFiles: string | FileDescriptor[],
  config: ZipitConfig
): Promise<{ orchestrator: DownloadOrchestrator; isRecovered: boolean }>

This is the main entry point users call. If a sessionId is passed and found in IndexedDB, recover it. Otherwise create fresh.

Include unit tests for recoverSession covering all three file states.