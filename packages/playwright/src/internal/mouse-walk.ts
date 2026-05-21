import type { Point } from '@humanjs/core';
import type { Page } from 'playwright';
import { sleep } from './timing';

/**
 * Walks the mouse along `path` over `durationMs`, evenly spacing the steps.
 * Generic helper used by both the click executor (which derives `durationMs`
 * from `personality.mouse.travelTimeMs`) and the read executor (which uses
 * the reading dwell duration so the cursor finishes its scan exactly as the
 * dwell elapses).
 *
 * - Empty path is a no-op.
 * - `durationMs <= 0` jumps through the path without inter-step delays
 *   (matches `speed: 'instant'` behavior).
 */
export async function walkMouseAlongPath(
  page: Page,
  path: readonly Point[],
  durationMs: number,
): Promise<void> {
  if (path.length === 0) return;
  const stepDelayMs = path.length > 1 && durationMs > 0 ? durationMs / (path.length - 1) : 0;

  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    if (!point) continue;
    await page.mouse.move(point.x, point.y);
    if (i < path.length - 1 && stepDelayMs > 0) {
      await sleep(stepDelayMs);
    }
  }
}
