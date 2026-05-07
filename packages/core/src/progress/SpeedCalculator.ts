interface SpeedSample {
  timestamp: number;
  bytesReceived: number;
}

/** Calculates download speed from a weighted sliding window of byte samples. */
export class SpeedCalculator {
  private readonly samples: SpeedSample[] = [];

  /**
   * Creates a speed calculator.
   *
   * @param windowSizeMs - Sliding window length in milliseconds.
   */
  constructor(private readonly windowSizeMs = 5000) {}

  /**
   * Records bytes received at the current time.
   *
   * @param bytes - Number of newly received bytes.
   */
  record(bytes: number): void {
    if (bytes <= 0) {
      return;
    }

    const now = Date.now();
    this.samples.push({ timestamp: now, bytesReceived: bytes });
    this.prune(now);
  }

  /**
   * Calculates weighted moving-average speed in bytes per second.
   *
   * More recent samples receive a higher weight than older samples.
   *
   * @returns Current speed in bytes per second, or 0 when no samples are in the window.
   */
  getSpeedBytesPerSec(): number {
    const now = Date.now();
    this.prune(now);

    if (this.samples.length === 0) {
      return 0;
    }

    const cutoff = now - this.windowSizeMs;
    const weightedBytes = this.samples.reduce((sum, sample) => {
      const ageRatio = (sample.timestamp - cutoff) / this.windowSizeMs;
      const weight = Math.max(0, ageRatio);
      return sum + sample.bytesReceived * weight;
    }, 0);

    return weightedBytes / (this.windowSizeMs / 1000);
  }

  /**
   * Estimates remaining seconds for a number of bytes.
   *
   * @param remainingBytes - Bytes not yet downloaded.
   * @returns ETA rounded up to seconds, or undefined when speed is zero.
   */
  getEtaSeconds(remainingBytes: number): number | undefined {
    const speed = this.getSpeedBytesPerSec();
    if (speed <= 0 || !Number.isFinite(remainingBytes)) {
      return undefined;
    }
    return Math.ceil(remainingBytes / speed);
  }

  /** Clears all speed samples. */
  reset(): void {
    this.samples.length = 0;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowSizeMs;
    while (this.samples.length > 0 && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }
  }
}

export default SpeedCalculator;
