In packages/core/src/progress/SpeedCalculator.ts, implement a class SpeedCalculator using a weighted moving average.

Requirements:

Constructor: (windowSizeMs = 5000)
  Maintains a sliding window of (timestamp, bytesReceived) samples.

Methods:

1. record(bytes: number): void
   Records that `bytes` were received RIGHT NOW (uses Date.now() internally).

2. getSpeedBytesPerSec(): number
   Calculates speed using a weighted moving average over the last windowSizeMs milliseconds.
   More recent samples should have higher weight.
   Returns 0 if no samples in window.

3. getEtaSeconds(remainingBytes: number): number | undefined
   Returns undefined if speed is 0 or remaining is unknown.
   Returns Math.ceil(remainingBytes / speed) otherwise.

4. reset(): void
   Clears all samples.

Also implement in packages/core/src/progress/GlobalProgressTracker.ts:

Class GlobalProgressTracker

Constructor: (files: FileDescriptor[])
  Pre-computes totalBytes (sum of all sizeBytes, undefined if any are unknown).

Methods:

1. update(progress: FileProgress): void
   Updates internal state for the given fileId.

2. getGlobalProgress(): GlobalProgress
   Calculates and returns the current GlobalProgress snapshot.
   Uses SpeedCalculator for speed/ETA.

3. onUpdate(callback: (g: GlobalProgress) => void): () => void
   Subscribers are notified every time update() is called.

Include Vitest unit tests for SpeedCalculator covering:
- Empty state
- Single sample
- Samples outside the window are excluded
- Weighted average is higher when recent samples are faster