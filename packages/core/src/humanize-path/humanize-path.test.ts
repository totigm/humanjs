import { describe, expect, it } from 'vitest';
import type { Point } from '../bezier';
import { createRng } from '../rng';
import { applyMicroJitter, applyVelocityProfile, humanizePath } from './index';

function straightPath(steps: number, length = 200): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: (i * length) / steps,
    y: 0,
  }));
}

function segmentDistance(path: readonly Point[], i: number): number {
  const a = path[i];
  const b = path[i + 1];
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe('humanizePath', () => {
  it('preserves endpoints exactly', () => {
    const path = straightPath(25);
    const result = humanizePath(path, createRng('endpoints'));
    expect(result[0]).toEqual(path[0]);
    expect(result[result.length - 1]).toEqual(path[path.length - 1]);
  });

  it('preserves the input length', () => {
    const path = straightPath(25);
    const result = humanizePath(path, createRng('length'));
    expect(result.length).toBe(path.length);
  });

  it('produces identical output for identical seeds', () => {
    const path = straightPath(25);
    const a = humanizePath(path, createRng('seed-a'));
    const b = humanizePath(path, createRng('seed-a'));
    expect(a).toEqual(b);
  });

  it('produces different interior points for different seeds', () => {
    const path = straightPath(25);
    const a = humanizePath(path, createRng('seed-a'));
    const b = humanizePath(path, createRng('seed-b'));
    expect(a[10]).not.toEqual(b[10]);
  });

  it('returns the input unchanged when both transforms are disabled', () => {
    const path = straightPath(10);
    const result = humanizePath(path, createRng('noop'), {
      velocityProfile: 0,
      jitterPx: 0,
    });
    expect(result).toEqual(path);
  });

  it('clamps velocityProfile to [0, 1]', () => {
    const path = straightPath(10);
    // Out-of-range strengths should not throw and should still return a valid path.
    const result = humanizePath(path, createRng('clamp'), {
      velocityProfile: 2,
      jitterPx: 0,
    });
    expect(result.length).toBe(path.length);
    expect(result[0]).toEqual(path[0]);
  });
});

describe('applyVelocityProfile', () => {
  it('clusters samples near the endpoints when fully applied', () => {
    const path = straightPath(20);
    const result = applyVelocityProfile(path, 1);

    const firstSegment = segmentDistance(result, 0);
    const middleSegment = segmentDistance(result, Math.floor(result.length / 2));
    const lastSegment = segmentDistance(result, result.length - 2);

    // Middle should be significantly faster (longer step) than either end.
    expect(middleSegment).toBeGreaterThan(firstSegment * 2);
    expect(middleSegment).toBeGreaterThan(lastSegment * 2);
  });

  it('produces symmetric spacing around the midpoint', () => {
    const path = straightPath(20);
    const result = applyVelocityProfile(path, 1);

    // First segment ≈ last segment (both slow); checks symmetry of the smoothstep.
    expect(segmentDistance(result, 0)).toBeCloseTo(segmentDistance(result, result.length - 2), 6);
  });

  it('is a no-op when strength is 0', () => {
    const path = straightPath(10);
    const result = applyVelocityProfile(path, 0);
    expect(result).toEqual(path);
  });

  it('preserves endpoints regardless of strength', () => {
    const path = straightPath(10);
    for (const strength of [0, 0.3, 0.7, 1]) {
      const result = applyVelocityProfile(path, strength);
      expect(result[0]).toEqual(path[0]);
      expect(result[result.length - 1]).toEqual(path[path.length - 1]);
    }
  });

  it('handles zero-length paths gracefully', () => {
    const path: Point[] = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ];
    const result = applyVelocityProfile(path, 1);
    expect(result).toEqual(path);
  });

  it('handles empty and single-point paths', () => {
    expect(applyVelocityProfile([], 1)).toEqual([]);
    expect(applyVelocityProfile([{ x: 10, y: 10 }], 1)).toEqual([{ x: 10, y: 10 }]);
  });
});

describe('applyMicroJitter', () => {
  it('preserves endpoints exactly', () => {
    const path = straightPath(10);
    const result = applyMicroJitter(path, createRng('jitter'), 2);
    expect(result[0]).toEqual(path[0]);
    expect(result[result.length - 1]).toEqual(path[path.length - 1]);
  });

  it('perturbs interior points', () => {
    const path = straightPath(10);
    const result = applyMicroJitter(path, createRng('jitter'), 2);
    let perturbedCount = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const original = path[i];
      const noisy = result[i];
      if (original && noisy && (noisy.x !== original.x || noisy.y !== original.y)) {
        perturbedCount++;
      }
    }
    expect(perturbedCount).toBeGreaterThan(0);
  });

  it('keeps jitter bounded: avg deviation << jitterPx, no large outliers', () => {
    const path = straightPath(100);
    const jitterPx = 1;
    const result = applyMicroJitter(path, createRng('bounds'), jitterPx);

    let totalDeviation = 0;
    let maxDeviation = 0;
    let count = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const original = path[i];
      const noisy = result[i];
      if (!original || !noisy) continue;
      const deviation = Math.hypot(noisy.x - original.x, noisy.y - original.y);
      totalDeviation += deviation;
      maxDeviation = Math.max(maxDeviation, deviation);
      count++;
    }

    // Expected mean distance for 2D Gaussian with σ = jitterPx/3:
    // E[||(X, Y)||] = σ √(π/2) ≈ 0.42·σ for σ = 1/3 ≈ 0.14.
    // Cap generously at half of jitterPx — far above expected, way below the limit.
    expect(totalDeviation / count).toBeLessThan(jitterPx / 2);
    // Outliers beyond 3× jitterPx (9σ on each axis) effectively never happen.
    expect(maxDeviation).toBeLessThan(jitterPx * 3);
  });

  it('is a no-op when jitterPx is 0', () => {
    const path = straightPath(10);
    const result = applyMicroJitter(path, createRng('zero'), 0);
    expect(result).toEqual(path);
  });

  it('handles negative jitter as no-op', () => {
    const path = straightPath(10);
    const result = applyMicroJitter(path, createRng('negative'), -5);
    expect(result).toEqual(path);
  });

  it('handles empty path', () => {
    expect(applyMicroJitter([], createRng('empty'), 1)).toEqual([]);
  });
});
