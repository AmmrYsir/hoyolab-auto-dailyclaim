import { describe, expect, it } from 'bun:test';
import { formatDuration, getRandomInt, randomDelay } from '../src/utils/time.ts';

describe('Time Utilities', () => {
  it('should format duration in ms and seconds', () => {
    expect(formatDuration(450)).toBe('450ms');
    expect(formatDuration(2500)).toBe('2.50s');
    expect(formatDuration(10500)).toBe('10.50s');
  });

  it('should generate random integers within range', () => {
    for (let i = 0; i < 50; i++) {
      const val = getRandomInt(10, 20);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(20);
    }
  });

  it('should resolve randomDelay within specified bounds', async () => {
    const start = Date.now();
    const delay = await randomDelay(20, 50);
    const elapsed = Date.now() - start;

    expect(delay).toBeGreaterThanOrEqual(20);
    expect(delay).toBeLessThanOrEqual(50);
    expect(elapsed).toBeGreaterThanOrEqual(15);
  });
});
