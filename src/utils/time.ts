/**
 * Time and delay utility functions with jitter support.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export function getRandomInt(min: number, max: number): number {
  const minVal = Math.ceil(min);
  const maxVal = Math.floor(max);
  if (minVal >= maxVal) return minVal;
  return Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
}

export async function randomDelay(minMs: number, maxMs: number): Promise<number> {
  const delayTime = getRandomInt(minMs, maxMs);
  if (delayTime > 0) {
    await sleep(delayTime);
  }
  return delayTime;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}
