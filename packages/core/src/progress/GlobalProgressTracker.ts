import type { FileDescriptor, FileProgress, GlobalProgress } from '../types';
import SpeedCalculator from './SpeedCalculator';

type GlobalProgressCallback = (progress: GlobalProgress) => void;

/** Tracks aggregate progress for a set of files. */
export class GlobalProgressTracker {
  private readonly progressByFileId = new Map<string, FileProgress>();
  private readonly callbacks = new Set<GlobalProgressCallback>();
  private readonly speedCalculator = new SpeedCalculator();
  private readonly totalBytes: number | undefined;

  /**
   * Creates a global progress tracker.
   *
   * @param files - Files included in the session.
   */
  constructor(private readonly files: FileDescriptor[]) {
    this.totalBytes = files.every((file) => file.sizeBytes !== undefined)
      ? files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0)
      : undefined;

    for (const file of files) {
      this.progressByFileId.set(file.id, {
        fileId: file.id,
        phase: 'pending',
        downloadedBytes: 0,
        totalBytes: file.sizeBytes,
      });
    }
  }

  /**
   * Updates progress for one file and notifies subscribers.
   *
   * @param progress - Latest file progress.
   */
  update(progress: FileProgress): void {
    const previous = this.progressByFileId.get(progress.fileId);
    const delta = progress.downloadedBytes - (previous?.downloadedBytes ?? 0);
    this.speedCalculator.record(delta);
    this.progressByFileId.set(progress.fileId, progress);
    this.callbacks.forEach((callback) => callback(this.getGlobalProgress()));
  }

  /**
   * Returns the latest aggregate progress snapshot.
   *
   * @returns Global progress for the tracked files.
   */
  getGlobalProgress(): GlobalProgress {
    const progressValues = Array.from(this.progressByFileId.values());
    const totalFiles = this.files.length;
    const completedFiles = progressValues.filter((progress) => progress.phase === 'done').length;
    const downloadedBytes = progressValues.reduce(
      (sum, progress) => sum + progress.downloadedBytes,
      0
    );
    const speedBytesPerSecond = this.speedCalculator.getSpeedBytesPerSec();
    const remainingBytes =
      this.totalBytes === undefined ? undefined : Math.max(0, this.totalBytes - downloadedBytes);

    return {
      totalFiles,
      completedFiles,
      totalBytes: this.totalBytes,
      downloadedBytes,
      speedBytesPerSecond,
      etaSeconds:
        remainingBytes === undefined
          ? undefined
          : this.speedCalculator.getEtaSeconds(remainingBytes),
      phase: this.getPhase(progressValues),
    };
  }

  /**
   * Subscribes to aggregate progress updates.
   *
   * @param callback - Callback invoked after each file update.
   * @returns An unsubscribe function.
   */
  onUpdate(callback: GlobalProgressCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private getPhase(progressValues: FileProgress[]): GlobalProgress['phase'] {
    if (progressValues.length > 0 && progressValues.every((progress) => progress.phase === 'done')) {
      return 'done';
    }
    if (progressValues.some((progress) => progress.phase === 'zipping')) {
      return 'zipping';
    }
    return 'downloading';
  }
}

export default GlobalProgressTracker;
