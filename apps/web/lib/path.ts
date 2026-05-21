import { bezierPath, createRng, humanizePath, type Point } from '@humanjs/core';

export interface MakeHumanizedPathOptions {
  /** Bezier curvature, typically from `Personality.mouse.curvature`. */
  readonly curvature: number;
  /** Number of sampled points along the path. Defaults to 36. */
  readonly steps?: number;
  /** Sub-pixel jitter applied to interior points. Defaults to 0.6. */
  readonly jitterPx?: number;
  /** Velocity profile strength. Defaults to 1 (full bell-curve warp). */
  readonly velocityProfile?: number;
}

/**
 * Generate a humanized cursor path from `from` to `to`. Seeded for
 * determinism — the same seed always produces the same trajectory.
 */
export function makeHumanizedPath(
  from: Point,
  to: Point,
  seed: string,
  options: MakeHumanizedPathOptions,
): readonly Point[] {
  const rng = createRng(seed);
  const raw = bezierPath(from, to, rng, {
    curvature: options.curvature,
    steps: options.steps ?? 36,
  });
  return humanizePath(raw, rng, {
    velocityProfile: options.velocityProfile ?? 1,
    jitterPx: options.jitterPx ?? 0.6,
  });
}

/**
 * Linearly interpolate the point at the given progress (0..1) along
 * a sampled path. Out-of-range progress is clamped to the endpoints.
 */
export function pointAt(path: readonly Point[], progress: number): Point {
  if (path.length === 0) return { x: 0, y: 0 };
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const lastIdx = path.length - 1;
  const exact = clamped * lastIdx;
  const idx = Math.min(lastIdx, Math.floor(exact));
  const nextIdx = Math.min(lastIdx, idx + 1);
  const a = path[idx];
  const b = path[nextIdx];
  if (!a || !b) return path[0] ?? { x: 0, y: 0 };
  const local = exact - idx;
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

/**
 * Format a series of points as an SVG `d` attribute (`M x y L x y ...`).
 * Pass `upTo` to render only a prefix — useful for drawing a partial
 * trail behind a moving cursor. Returns `''` when there's nothing to draw
 * (empty path, or fewer than 2 points requested) so callers can use the
 * result directly without painting a degenerate single-point segment.
 */
export function toSvgPathD(path: readonly Point[], upTo?: number): string {
  if (path.length < 2) return '';
  if (upTo !== undefined && upTo < 2) return '';
  const slice = upTo === undefined ? path : path.slice(0, Math.min(path.length, upTo));
  return slice
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}
