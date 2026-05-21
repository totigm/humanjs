import type { Personality, Rng } from '@humanjs/core';
import type { Speed } from '..';

/**
 * Sleeps for `ms` milliseconds. Resolves immediately if `ms <= 0` so callers
 * can hand the result of `computeDwellTime` straight through without guards.
 */
export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Per-mode timing multiplier applied on top of personality.speed.
 *  - `'human'`:   1    — full humanization
 *  - `'fast'`:    0.5  — accelerated humanization (still humanized, just brisk)
 *  - `'instant'`: 0    — no delays (CI / snapshot mode)
 */
export function speedModeFactor(speed: Speed): number {
  switch (speed) {
    case 'fast':
      return 0.5;
    case 'instant':
      return 0;
    default:
      return 1;
  }
}

/**
 * Computes a dwell time in ms with deterministic jitter and personality scaling.
 *
 *   base   = meanMs
 *   jitter = base × jitterFraction × rand[-1, 1]
 *   total  = (base + jitter) × personality.speed × speedModeFactor(speed)
 *
 * Returns 0 for non-positive inputs so callers can skip the sleep entirely.
 */
export function computeDwellTime(
  meanMs: number,
  jitter: number,
  personality: Personality,
  speed: Speed,
  rng: Rng,
): number {
  if (meanMs <= 0) return 0;
  const jitterMag = meanMs * jitter;
  const offset = rng.nextFloat(-jitterMag, jitterMag);
  return Math.max(0, (meanMs + offset) * personality.speed * speedModeFactor(speed));
}
