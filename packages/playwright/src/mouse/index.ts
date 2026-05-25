import { bezierPath, humanizePath, type Personality, type Point, type Rng } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import type { Speed } from '../index';
import { walkMouseAlongPath } from '../internal/mouse-walk';
import { computeDwellTime, sleep, speedModeFactor } from '../internal/timing';

/** Runtime dependencies for a humanized mouse action. */
export interface MouseContext {
  readonly page: Page;
  readonly personality: Personality;
  readonly rng: Rng;
  readonly speed: Speed;
  /** Last known mouse position — used as the path start. */
  readonly getMousePosition: () => Point;
  /** Updates the last known mouse position after a move/click. */
  readonly setMousePosition: (point: Point) => void;
}

/** Result of a click action, returned to the caller for observability. */
export interface ClickResult {
  /** Coordinates the click landed at. */
  readonly target: Point;
}

/**
 * Executes a humanized click on a target locator.
 *
 * Steps:
 *  1. Resolve the target's bounding box.
 *  2. Pick a point inside it — Gaussian-centered so we never click dead-center,
 *     which is itself a bot signal.
 *  3. Generate a Bezier path from the current mouse position to the target.
 *  4. Apply velocity profile + micro-jitter via `humanizePath`.
 *  5. Walk the mouse along the path with timing scaled by personality + speed.
 *  6. Click at the target coordinates.
 *
 * In `speed: 'instant'`, all humanization is bypassed and Playwright's
 * native `locator.click()` is used directly.
 */
export async function executeClick(
  target: Locator | string,
  ctx: MouseContext,
): Promise<ClickResult> {
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;

  if (ctx.speed === 'instant') {
    // Read the bounding box BEFORE the click — the click may navigate away
    // or remove the element, after which `boundingBox()` returns null.
    const box = await locator.boundingBox();
    await locator.click();
    const center = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : ctx.getMousePosition();
    ctx.setMousePosition(center);
    return { target: center };
  }

  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(
      `Cannot click: element not found or has no bounding box (target: ${describeTarget(target)})`,
    );
  }

  const targetPoint = pickClickPoint(box, ctx.rng, ctx.personality.mouse.clickSpread);
  const startPoint = ctx.getMousePosition();

  const rawPath = bezierPath(startPoint, targetPoint, ctx.rng, {
    curvature: ctx.personality.mouse.curvature,
  });
  const path = humanizePath(rawPath, ctx.rng);

  const travelMs = computeTravelTime(path, ctx.personality, ctx.speed, ctx.rng);
  await walkMouseAlongPath(ctx.page, path, travelMs);

  // Hover dwell — a real user briefly settles on the target before clicking.
  const preClickMs = computeDwellTime(
    ctx.personality.dwell.preClickMs,
    ctx.personality.dwell.preClickJitter,
    ctx.personality,
    ctx.speed,
    ctx.rng,
  );
  if (preClickMs > 0) await sleep(preClickMs);

  // Commit the new position BEFORE the click side-effect. If the click throws
  // (page closed, target removed mid-flight), the next action still starts
  // from the correct mouse position.
  ctx.setMousePosition(targetPoint);
  await ctx.page.mouse.click(targetPoint.x, targetPoint.y);

  // Post-action dwell — a beat after the click before the next action.
  const postActionMs = computeDwellTime(
    ctx.personality.dwell.postActionMs,
    ctx.personality.dwell.postActionJitter,
    ctx.personality,
    ctx.speed,
    ctx.rng,
  );
  if (postActionMs > 0) await sleep(postActionMs);

  return { target: targetPoint };
}

/** Bounding box returned by Playwright's `Locator.boundingBox()`. */
interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Picks a click point inside the bounding box. Gaussian-centered so the
 * majority of clicks land near the visual center but with natural spread.
 * Clamped to never fall outside the element.
 */
function pickClickPoint(box: BoundingBox, rng: Rng, clickSpread: number): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Standard deviation scales with each dimension separately, so wide
  // elements scatter horizontally and tall elements scatter vertically.
  // The clickSpread fraction comes from the personality — precise users
  // cluster near center, distracted users scatter across the target.
  const sigmaX = box.width * clickSpread;
  const sigmaY = box.height * clickSpread;
  const x = clamp(cx + rng.nextGaussian(0, sigmaX), box.x, box.x + box.width);
  const y = clamp(cy + rng.nextGaussian(0, sigmaY), box.y, box.y + box.height);
  return { x, y };
}

/**
 * Travel time in ms for the given path.
 *
 *   base = (totalDistance / 1000) * Personality.mouse.travelTimeMs
 *   jitter = base * Personality.mouse.travelTimeJitter * rand[-1, 1]
 *   total = (base + jitter) * Personality.speed * speedModeFactor
 */
function computeTravelTime(
  path: readonly Point[],
  personality: Personality,
  speed: Speed,
  rng: Rng,
): number {
  let distance = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    if (!prev || !curr) continue;
    distance += Math.hypot(curr.x - prev.x, curr.y - prev.y);
  }

  const baseTime = (distance / 1000) * personality.mouse.travelTimeMs;
  const jitterMag = baseTime * personality.mouse.travelTimeJitter;
  const jitter = rng.nextFloat(-jitterMag, jitterMag);
  const total = (baseTime + jitter) * personality.speed * speedModeFactor(speed);
  return Math.max(0, total);
}

function describeTarget(target: Locator | string): string {
  return typeof target === 'string' ? target : (target.toString?.() ?? 'locator');
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
