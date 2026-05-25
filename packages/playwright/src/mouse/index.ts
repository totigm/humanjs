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

/** Anything that can resolve to a click/move point. */
export type MouseTarget = Locator | string | Point;

/** Result of a click action, returned to the caller for observability. */
export interface ClickResult {
  /** Coordinates the click landed at. */
  readonly target: Point;
}

/** Result of a hover action. */
export interface HoverResult {
  /** Coordinates the cursor settled at. */
  readonly target: Point;
}

/** Result of a drag action. */
export interface DragResult {
  /** Coordinates the drag started from. */
  readonly from: Point;
  /** Coordinates the drag ended at. */
  readonly to: Point;
}

/** Options for {@link executeClick}. */
export interface ClickOptions {
  /**
   * Mouse button to press. Defaults to `'left'`. `'right'` produces a
   * context-menu click; `'middle'` is the wheel-button click (rarely used).
   */
  readonly button?: 'left' | 'right' | 'middle';
}

/**
 * Executes a humanized click on a target.
 *
 * Steps:
 *  1. Resolve the target's bounding box (or accept a raw `Point`).
 *  2. Pick a click point inside it — Gaussian-centered so we never click
 *     dead-center, which is itself a bot signal.
 *  3. Generate a Bezier path from the current mouse position to the target.
 *  4. Apply velocity profile + micro-jitter via `humanizePath`.
 *  5. Walk the mouse along the path with timing scaled by personality + speed.
 *  6. Hover dwell — a real user briefly settles on the target before clicking.
 *  7. Click at the target coordinates with the configured button.
 *
 * In `speed: 'instant'`, all humanization is bypassed and Playwright's
 * native `locator.click()` is used directly.
 */
export async function executeClick(
  target: Locator | string,
  ctx: MouseContext,
  options: ClickOptions = {},
): Promise<ClickResult> {
  const button = options.button ?? 'left';
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;

  if (ctx.speed === 'instant') {
    // Read the bounding box BEFORE the click — the click may navigate away
    // or remove the element, after which `boundingBox()` returns null.
    const box = await locator.boundingBox();
    await locator.click({ button });
    const center = box
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : ctx.getMousePosition();
    ctx.setMousePosition(center);
    return { target: center };
  }

  const targetPoint = await moveToTarget(target, ctx, 'click');

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
  await ctx.page.mouse.click(targetPoint.x, targetPoint.y, { button });

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

/**
 * Executes a humanized hover. Moves the cursor to the target along a Bezier
 * path, settles on it briefly (the same pre-click dwell `click` uses), and
 * leaves the cursor parked there. No click is dispatched.
 *
 * Useful for hover-triggered UI (tooltips, dropdowns) and for explicitly
 * positioning the cursor when subsequent actions should originate from a
 * specific element.
 *
 * In `speed: 'instant'`, dispatches a single `page.mouse.move()` to the
 * element's center — same bypass semantic as click's instant mode.
 */
export async function executeHover(
  target: Locator | string,
  ctx: MouseContext,
): Promise<HoverResult> {
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;

  if (ctx.speed === 'instant') {
    const box = await locator.boundingBox();
    if (!box) {
      throw new Error(
        `Cannot hover: element not found or has no bounding box (target: ${describeTarget(target)})`,
      );
    }
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await ctx.page.mouse.move(center.x, center.y);
    ctx.setMousePosition(center);
    return { target: center };
  }

  const targetPoint = await moveToTarget(target, ctx, 'hover');

  // Use the pre-click dwell as the "settle on the hover target" beat —
  // same shape as click's hover-before-click motion.
  const dwellMs = computeDwellTime(
    ctx.personality.dwell.preClickMs,
    ctx.personality.dwell.preClickJitter,
    ctx.personality,
    ctx.speed,
    ctx.rng,
  );
  if (dwellMs > 0) await sleep(dwellMs);

  ctx.setMousePosition(targetPoint);
  return { target: targetPoint };
}

/**
 * Executes a humanized drag from one location to another.
 *
 *  1. Move the cursor to the `from` target along a Bezier path.
 *  2. Press the left mouse button down.
 *  3. Walk a fresh Bezier path from `from` to `to`, with the button still
 *     held. This is the actual drag motion the page sees.
 *  4. Release the button at `to`.
 *
 * Both endpoints accept a CSS selector, a Locator, or a literal `Point` —
 * the last form is essential for canvas/SVG drags where the destination
 * isn't a DOM element.
 *
 * In `speed: 'instant'`, dispatches a single `mouse.down → move → up`
 * sequence at the resolved endpoints without humanized motion.
 */
export async function executeDrag(
  from: MouseTarget,
  to: MouseTarget,
  ctx: MouseContext,
): Promise<DragResult> {
  const fromPoint = await resolveDragTarget(from, ctx);
  const toPoint = await resolveDragTarget(to, ctx);

  if (ctx.speed === 'instant') {
    await ctx.page.mouse.move(fromPoint.x, fromPoint.y);
    await ctx.page.mouse.down();
    await ctx.page.mouse.move(toPoint.x, toPoint.y);
    await ctx.page.mouse.up();
    ctx.setMousePosition(toPoint);
    return { from: fromPoint, to: toPoint };
  }

  // 1. Move to the start of the drag.
  await walkBezierTo(fromPoint, ctx);
  ctx.setMousePosition(fromPoint);

  // 2. Press down. Beat between settling on the source and starting to drag
  // — real users don't grab the same frame they arrive.
  const preDragMs = computeDwellTime(
    ctx.personality.dwell.preClickMs,
    ctx.personality.dwell.preClickJitter,
    ctx.personality,
    ctx.speed,
    ctx.rng,
  );
  if (preDragMs > 0) await sleep(preDragMs);
  await ctx.page.mouse.down();

  // 3. Walk to the destination with the button still held. Generate a fresh
  // humanized path so the drag motion has its own curve + jitter shape.
  const rawPath = bezierPath(fromPoint, toPoint, ctx.rng, {
    curvature: ctx.personality.mouse.curvature,
  });
  const path = humanizePath(rawPath, ctx.rng);
  const travelMs = computeTravelTime(path, ctx.personality, ctx.speed, ctx.rng);
  await walkMouseAlongPath(ctx.page, path, travelMs);

  // 4. Release. Post-action dwell so the next action doesn't fire in the
  // same frame as the drop.
  await ctx.page.mouse.up();
  ctx.setMousePosition(toPoint);

  const postActionMs = computeDwellTime(
    ctx.personality.dwell.postActionMs,
    ctx.personality.dwell.postActionJitter,
    ctx.personality,
    ctx.speed,
    ctx.rng,
  );
  if (postActionMs > 0) await sleep(postActionMs);

  return { from: fromPoint, to: toPoint };
}

/**
 * Shared core for any action that moves the cursor to an element-resolved
 * target: resolve the bounding box, pick a Gaussian point inside, generate
 * the Bezier path, walk it. Returns the chosen target point.
 *
 * Used by `executeClick` and `executeHover` (drag reaches the same logic
 * via `resolveDragTarget` + `walkBezierTo` because its `from` can also be
 * a `Point`).
 */
async function moveToTarget(
  target: Locator | string,
  ctx: MouseContext,
  action: 'click' | 'hover',
): Promise<Point> {
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(
      `Cannot ${action}: element not found or has no bounding box (target: ${describeTarget(target)})`,
    );
  }
  const targetPoint = pickClickPoint(box, ctx.rng, ctx.personality.mouse.clickSpread);
  await walkBezierTo(targetPoint, ctx);
  return targetPoint;
}

/** Walks a humanized Bezier path from the current mouse position to `to`. */
async function walkBezierTo(to: Point, ctx: MouseContext): Promise<void> {
  const startPoint = ctx.getMousePosition();
  const rawPath = bezierPath(startPoint, to, ctx.rng, {
    curvature: ctx.personality.mouse.curvature,
  });
  const path = humanizePath(rawPath, ctx.rng);
  const travelMs = computeTravelTime(path, ctx.personality, ctx.speed, ctx.rng);
  await walkMouseAlongPath(ctx.page, path, travelMs);
}

/** Resolves a drag endpoint (selector, Locator, or raw Point) to coordinates. */
async function resolveDragTarget(target: MouseTarget, ctx: MouseContext): Promise<Point> {
  if (isPoint(target)) return target;
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(
      `Cannot drag: element not found or has no bounding box (target: ${describeTarget(target)})`,
    );
  }
  return pickClickPoint(box, ctx.rng, ctx.personality.mouse.clickSpread);
}

/** Type guard for raw `Point` targets — distinguishes them from Locator/string. */
function isPoint(target: MouseTarget): target is Point {
  return (
    typeof target === 'object' &&
    target !== null &&
    !('boundingBox' in target) &&
    typeof (target as Point).x === 'number' &&
    typeof (target as Point).y === 'number'
  );
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

function describeTarget(target: MouseTarget): string {
  if (isPoint(target)) return `point(${target.x}, ${target.y})`;
  return typeof target === 'string' ? target : (target.toString?.() ?? 'locator');
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
