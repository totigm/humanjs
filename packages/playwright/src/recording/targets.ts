import type { Point } from '@humanjs/core';

/**
 * A raw-coordinate target serializes as `point(x, y)` (it has no selector).
 * Shared by the code generator — which emits it verbatim, flagged — and the
 * replayer, which turns it back into a {@link Point}.
 */
export const POINT_RE = /^point\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;

/** Parse a recorded target description into a {@link Point}, or `null` if it's a selector. */
export function parsePointTarget(desc: unknown): Point | null {
  const match = String(desc ?? '').match(POINT_RE);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

/**
 * A recorded target as a runtime mouse target: a {@link Point} for raw
 * coordinates, otherwise the selector string.
 */
export function resolveMouseTarget(desc: unknown): Point | string {
  return parsePointTarget(desc) ?? String(desc ?? '');
}
