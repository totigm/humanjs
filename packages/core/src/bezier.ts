/**
 * Bezier path generation, adapted from ghost-cursor.
 *
 * Original: https://github.com/Xetera/ghost-cursor (MIT, © 2020 Xetera).
 * Full attribution in THIRD_PARTY_NOTICES.md at the repo root.
 *
 * HumanJS adaptations:
 *  - Reimplemented in TypeScript with HumanJS's `Rng` interface for
 *    seeded determinism (same seed → identical path on every run)
 *  - Removed Puppeteer dependency: returns plain coordinates instead of
 *    executing on a page
 *  - Driven by `Personality.mouse.curvature` rather than an options object
 *
 * The math itself — cubic Bezier with perpendicularly-offset control
 * points — is the canonical approach for humanized cursor trajectories.
 * Realism layers on top (velocity profile, micro-jitter, overshoot) live
 * in separate modules; this file is pure spatial path generation.
 */

import type { Rng } from './rng.js';

/** A 2D point in screen coordinates. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Options for {@link bezierPath}. */
export interface BezierPathOptions {
  /**
   * Curvature factor: 0 produces a straight line, 1 produces strongly
   * curved paths. Driven by `Personality.mouse.curvature`.
   */
  readonly curvature: number;
  /**
   * Number of segments to sample. The returned array has `steps + 1`
   * points, including both endpoints. Defaults to 25.
   */
  readonly steps?: number;
}

/**
 * Generates a cubic Bezier path from `start` to `end`.
 *
 * Control points are offset perpendicular to the direct start→end line
 * by random magnitudes scaled by `curvature`. The curve is then sampled
 * uniformly; applying a realistic velocity profile to those samples is
 * a separate post-processing step.
 *
 * The returned array always begins at `start` and ends at `end` exactly.
 *
 * @example
 * ```ts
 * const rng = createRng('session-42');
 * const path = bezierPath({ x: 0, y: 0 }, { x: 800, y: 600 }, rng, {
 *   curvature: 0.4,
 *   steps: 30,
 * });
 * // path[0]  === { x: 0, y: 0 }
 * // path[30] === { x: 800, y: 600 }
 * ```
 */
export function bezierPath(
  start: Point,
  end: Point,
  rng: Rng,
  options: BezierPathOptions,
): Point[] {
  const steps = options.steps ?? 25;
  const [control1, control2] = generateControlPoints(start, end, rng, options.curvature);
  return sampleCubicBezier(start, control1, control2, end, steps);
}

/**
 * Picks two control points offset perpendicular to the start→end line.
 * Magnitudes are uniform random in `[-distance * curvature, +distance * curvature]`,
 * which produces curves on either side of the direct line.
 */
function generateControlPoints(
  start: Point,
  end: Point,
  rng: Rng,
  curvature: number,
): [Point, Point] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  // Unit vector perpendicular to start→end. Guard against zero-length
  // movement (start === end) — the perpendicular is undefined there, so
  // any direction works since the control points get multiplied by zero.
  const length = distance || 1;
  const perpX = -dy / length;
  const perpY = dx / length;

  const maxOffset = distance * curvature;
  const offset1 = rng.nextFloat(-maxOffset, maxOffset);
  const offset2 = rng.nextFloat(-maxOffset, maxOffset);

  return [
    {
      x: start.x + dx / 3 + perpX * offset1,
      y: start.y + dy / 3 + perpY * offset1,
    },
    {
      x: start.x + (2 * dx) / 3 + perpX * offset2,
      y: start.y + (2 * dy) / 3 + perpY * offset2,
    },
  ];
}

/**
 * Samples a cubic Bezier curve at `steps + 1` evenly-spaced parameter
 * values from 0 to 1. The endpoints are exact.
 *
 * Standard cubic Bezier formula:
 *   B(t) = (1-t)³·P₀ + 3(1-t)²t·P₁ + 3(1-t)t²·P₂ + t³·P₃
 */
function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push(cubicBezierAt(p0, p1, p2, p3, t));
  }
  return points;
}

function cubicBezierAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}
