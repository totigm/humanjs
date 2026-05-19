/**
 * Path post-processing that turns a uniformly-sampled Bezier curve into a
 * more realistically-shaped trajectory.
 *
 * Two transformations applied in sequence:
 *
 *  1. Velocity profile — resample the path so that samples cluster near
 *     the endpoints and spread out in the middle. The result has a
 *     bell-shaped velocity curve, matching the minimum-jerk profile
 *     observed in human motor studies (Meyer et al., 1988).
 *
 *  2. Micro-jitter — add tiny Gaussian noise (sub-pixel by default) to
 *     each interior point, simulating hand tremor. Endpoints stay exact
 *     so click targets land cleanly.
 *
 * Pure spatial transforms; no Playwright or Puppeteer dependency.
 */

import type { Point } from '../bezier';
import type { Rng } from '../rng';

/** Options for {@link humanizePath}. */
export interface HumanizePathOptions {
  /**
   * Strength of the bell-curve velocity profile, `0..1`.
   * - `0` keeps uniform spacing (no resampling)
   * - `1` applies the full smoothstep bell curve
   *
   * Default: `1`. Clamped to `[0, 1]`.
   */
  readonly velocityProfile?: number;
  /**
   * Maximum sub-pixel jitter applied to interior points as Gaussian noise.
   * Endpoints are never jittered. Default: `0.5` pixels.
   */
  readonly jitterPx?: number;
}

/**
 * Applies velocity profiling and micro-jitter to a path.
 *
 * Order matters: velocity first (resampling), jitter second (noise atop the
 * resampled points). Reversing would smooth out some of the jitter during
 * resampling.
 *
 * The returned array has the same length as the input. The first and last
 * points are preserved exactly.
 *
 * @example
 * ```ts
 * const raw = bezierPath(start, end, rng, { curvature: 0.4 });
 * const humanized = humanizePath(raw, rng);
 * // Same endpoints, same length, but with bell-curve velocity + sub-pixel noise.
 * ```
 */
export function humanizePath(
  path: readonly Point[],
  rng: Rng,
  options: HumanizePathOptions = {},
): Point[] {
  const velocityProfile = clamp01(options.velocityProfile ?? 1);
  const jitterPx = Math.max(0, options.jitterPx ?? 0.5);

  const resampled = applyVelocityProfile(path, velocityProfile);
  return applyMicroJitter(resampled, rng, jitterPx);
}

/**
 * Resamples a path so spacing reflects a bell-curve velocity: small steps
 * near the endpoints (slow motion), larger steps in the middle (fast).
 *
 * @param strength `0` returns a copy of the input. `1` applies the full
 *   smoothstep warp. Intermediate values lerp between them.
 */
export function applyVelocityProfile(path: readonly Point[], strength: number): Point[] {
  if (path.length < 2 || strength <= 0) return [...path];

  // Compute cumulative arc length so we can resample by distance.
  const arcLengths: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    if (!prev || !curr) continue;
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    arcLengths.push((arcLengths[i - 1] ?? 0) + Math.hypot(dx, dy));
  }
  const total = arcLengths[arcLengths.length - 1] ?? 0;
  if (total === 0) return [...path];

  const steps = path.length;
  const out: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const warped = lerp(t, smoothstep(t), strength);
    out.push(pointAtArcLength(path, arcLengths, warped * total));
  }
  return out;
}

/**
 * Adds Gaussian noise to each interior point in `path`. Endpoints stay
 * exact. The standard deviation is `jitterPx / 3` so ~99.7% of samples
 * fall within `±jitterPx`.
 */
export function applyMicroJitter(path: readonly Point[], rng: Rng, jitterPx: number): Point[] {
  if (jitterPx <= 0 || path.length === 0) return [...path];
  const stdDev = jitterPx / 3;
  const out: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    if (!point) continue;
    const isEndpoint = i === 0 || i === path.length - 1;
    if (isEndpoint) {
      out.push(point);
    } else {
      out.push({
        x: point.x + rng.nextGaussian(0, stdDev),
        y: point.y + rng.nextGaussian(0, stdDev),
      });
    }
  }
  return out;
}

/**
 * Finds the point at a given cumulative arc length along the path.
 * Linearly interpolates between the two surrounding samples.
 */
function pointAtArcLength(
  path: readonly Point[],
  arcLengths: readonly number[],
  target: number,
): Point {
  // Locate the segment containing `target`.
  let segment = 0;
  while (
    segment < arcLengths.length - 1 &&
    (arcLengths[segment + 1] ?? Number.POSITIVE_INFINITY) < target
  ) {
    segment++;
  }

  const start = path[segment];
  const end = path[segment + 1] ?? start;
  if (!start || !end) {
    // Should be unreachable — path is non-empty and segment is in bounds.
    return path[0] as Point;
  }

  const segStartLen = arcLengths[segment] ?? 0;
  const segEndLen = arcLengths[segment + 1] ?? segStartLen;
  const segSpan = segEndLen - segStartLen;
  const localT = segSpan > 0 ? (target - segStartLen) / segSpan : 0;

  return {
    x: start.x + localT * (end.x - start.x),
    y: start.y + localT * (end.y - start.y),
  };
}

/**
 * Standard smoothstep: 3t² − 2t³. Maps `[0, 1] → [0, 1]` with zero
 * derivative at both endpoints, giving a bell-shaped velocity curve.
 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
