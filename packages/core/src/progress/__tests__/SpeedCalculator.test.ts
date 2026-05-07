import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpeedCalculator from '../SpeedCalculator';

describe('SpeedCalculator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zero for empty state', () => {
    const calculator = new SpeedCalculator(1000);

    expect(calculator.getSpeedBytesPerSec()).toBe(0);
    expect(calculator.getEtaSeconds(1000)).toBeUndefined();
  });

  it('returns speed and ETA for a single sample', () => {
    const calculator = new SpeedCalculator(1000);

    calculator.record(1000);

    expect(calculator.getSpeedBytesPerSec()).toBeGreaterThan(0);
    expect(calculator.getEtaSeconds(1000)).toBeGreaterThan(0);
  });

  it('excludes samples outside the window', () => {
    const calculator = new SpeedCalculator(1000);
    calculator.record(1000);

    vi.setSystemTime(1001);

    expect(calculator.getSpeedBytesPerSec()).toBe(0);
  });

  it('weights speed higher when recent samples are faster', () => {
    const recentFast = new SpeedCalculator(1000);
    vi.setSystemTime(0);
    recentFast.record(100);
    vi.setSystemTime(900);
    recentFast.record(1000);
    const recentFastSpeed = recentFast.getSpeedBytesPerSec();

    const recentSlow = new SpeedCalculator(1000);
    vi.setSystemTime(0);
    recentSlow.record(1000);
    vi.setSystemTime(900);
    recentSlow.record(100);
    const recentSlowSpeed = recentSlow.getSpeedBytesPerSec();

    expect(recentFastSpeed).toBeGreaterThan(recentSlowSpeed);
  });
});
