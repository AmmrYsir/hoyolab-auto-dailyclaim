import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, getRandomInt, randomDelay } from '../src/utils/time.ts';

describe('Time Utilities', () => {
  it('should format duration in ms and seconds', () => {
    assert.strictEqual(formatDuration(450), '450ms');
    assert.strictEqual(formatDuration(2500), '2.50s');
    assert.strictEqual(formatDuration(10500), '10.50s');
  });

  it('should generate random integers within range', () => {
    for (let i = 0; i < 50; i++) {
      const val = getRandomInt(10, 20);
      assert.ok(val >= 10, `expected ${val} >= 10`);
      assert.ok(val <= 20, `expected ${val} <= 20`);
    }
  });

  it('should resolve randomDelay within specified bounds', async () => {
    const start = Date.now();
    const delay = await randomDelay(20, 50);
    const elapsed = Date.now() - start;

    assert.ok(delay >= 20, `expected ${delay} >= 20`);
    assert.ok(delay <= 50, `expected ${delay} <= 50`);
    assert.ok(elapsed >= 15, `expected ${elapsed} >= 15`);
  });
});
