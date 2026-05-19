/**
 * Seedable pseudo-random number generator used throughout HumanJS.
 *
 * Implementations must be deterministic given a seed: `createRng('foo')`
 * followed by N calls to `next()` always produces the same sequence on
 * any platform. This is what makes humanization snapshot-testable.
 */
export interface Rng {
  /** Returns a uniform float in [0, 1). */
  next(): number;
  /** Returns a uniform integer in [min, max). */
  nextInt(min: number, max: number): number;
  /** Returns a uniform float in [min, max). */
  nextFloat(min: number, max: number): number;
  /** Returns true with probability `p`. Clamped to [0, 1]. */
  chance(p: number): boolean;
  /**
   * Returns a Gaussian-distributed sample via the Box-Muller transform.
   * Defaults: mean = 0, standard deviation = 1.
   */
  nextGaussian(mean?: number, stdDev?: number): number;
}

/**
 * Creates a seedable PRNG. Identical seeds produce identical sequences
 * on every run and every platform.
 *
 * Algorithm: mulberry32 — a 32-bit, 2^32-period generator with strong
 * statistical properties for the timing distributions HumanJS produces.
 * Not suitable for cryptographic use.
 *
 * @param seed - String (hashed via FNV-1a), number (used directly), or
 *   undefined (system-time-based; sessions become non-reproducible).
 */
export function createRng(seed?: string | number): Rng {
  let state = resolveSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };

  return {
    next,
    nextInt(min, max) {
      return Math.floor(next() * (max - min)) + min;
    },
    nextFloat(min, max) {
      return next() * (max - min) + min;
    },
    chance(p) {
      const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
      return next() < clamped;
    },
    nextGaussian(mean = 0, stdDev = 1) {
      const u1 = next() || Number.MIN_VALUE;
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * stdDev;
    },
  };
}

/**
 * Normalizes any seed input to a 32-bit unsigned integer — the state shape
 * mulberry32 requires. Numbers (including negative or fractional ones) are
 * coerced via `>>> 0`; strings hash to a uint32 via FNV-1a; undefined
 * derives a non-reproducible seed from system time.
 */
function resolveSeed(seed: string | number | undefined): number {
  if (seed === undefined) {
    return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
  }
  if (typeof seed === 'number') {
    return seed >>> 0;
  }
  return hashString(seed);
}

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
