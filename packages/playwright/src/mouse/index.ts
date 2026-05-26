import { bezierPath, humanizePath, type Personality, type Point, type Rng } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import type { Speed } from '../index';
import { walkMouseAlongPath } from '../internal/mouse-walk';
import { computeDwellTime, sleep, speedModeFactor } from '../internal/timing';
import { executeScroll } from '../scroll';

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

/** Result of a move action. */
export interface MoveResult {
  /** Coordinates the cursor settled at. */
  readonly target: Point;
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
    // Playwright's `locator.click()` auto-scrolls the element into view as
    // part of its actionability checks, so we don't need a manual scroll
    // here. Read the box BEFORE the click — the click may navigate away or
    // remove the element, after which `boundingBox()` returns null.
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
  if (ctx.speed === 'instant') {
    // Snap the element into view only if its center isn't already inside
    // the viewport — same shape as the humanized path's viewport check.
    // Skipping the no-op `scrollIntoViewIfNeeded()` call saves a protocol
    // round-trip on every hover, and keeps all four instant-mode paths
    // (click via locator.click, hover, move, drag) consistent: scroll only
    // when required, never unconditionally.
    const box = await readBoxWithAutoScroll(target, ctx, 'hover');
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
  // Resolve `from` first, scrolling if needed. Then resolve `to` — if the
  // destination is also off-viewport, this triggers a second scroll. That's
  // the right shape for cross-viewport drags: a real user scrolls to grab,
  // then scrolls again to drop, rather than dragging through invisible space.
  const fromPoint = await resolveTargetPoint(from, ctx, 'drag');
  const toPoint = await resolveTargetPoint(to, ctx, 'drag');

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
 * Moves the cursor to `target` along a humanized Bezier path. Pure
 * positioning — no settle dwell, no element interaction, no event beyond
 * the standard mousemove sequence from walking the path. Accepts the same
 * `MouseTarget` shape as `drag`'s endpoints (Locator | string | Point).
 *
 * Distinct from `executeHover`:
 *
 *  - `move` is positional. Pass coordinates or an element; the cursor
 *    arrives and stops. Use this for canvas painting, slider drags
 *    composed with separate up/down, pre-shortcut placement, or cinematic
 *    beats where the cursor should pause somewhere with no element under it.
 *  - `hover` is element-bound and includes the post-arrival dwell that
 *    lets hover-state UI fire (tooltips, dropdown reveals).
 *
 * In `speed: 'instant'`, dispatches a single `page.mouse.move()` to the
 * resolved coordinates — same bypass semantic as the rest of the mouse
 * primitives in instant mode.
 */
export async function executeMove(target: MouseTarget, ctx: MouseContext): Promise<MoveResult> {
  const point = await resolveTargetPoint(target, ctx, 'move');

  if (ctx.speed === 'instant') {
    await ctx.page.mouse.move(point.x, point.y);
    ctx.setMousePosition(point);
    return { target: point };
  }

  await walkBezierTo(point, ctx);
  ctx.setMousePosition(point);
  return { target: point };
}

/**
 * Shared core for any action that moves the cursor to an element-resolved
 * target: resolve the bounding box, pick a Gaussian point inside, generate
 * the Bezier path, walk it. Returns the chosen target point.
 *
 * Used by `executeClick` and `executeHover` for their element-bound paths.
 * `executeDrag` and `executeMove` accept raw `Point` inputs too, so they
 * reach the same Bezier walk through `resolveTargetPoint` + `walkBezierTo`
 * instead of going through here.
 */
async function moveToTarget(
  target: Locator | string,
  ctx: MouseContext,
  action: 'click' | 'hover',
): Promise<Point> {
  const targetPoint = await resolveLocatorPoint(target, ctx, action);
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

/**
 * Resolves a mouse target (selector, Locator, or raw Point) to absolute
 * coordinates. Shared by `executeDrag` (both endpoints) and `executeMove`.
 *
 * `action` is just used to make the error message meaningful when an element
 * lookup fails — "Cannot drag: …" vs "Cannot move: …" reads better than a
 * generic "cannot resolve" complaint.
 *
 * Raw `Point` targets pass through untouched — the caller chose explicit
 * coordinates, so we don't auto-scroll (which has no element to track).
 * Element targets go through the auto-scroll-aware path.
 */
async function resolveTargetPoint(
  target: MouseTarget,
  ctx: MouseContext,
  action: 'drag' | 'move',
): Promise<Point> {
  if (isPoint(target)) return target;
  return resolveLocatorPoint(target, ctx, action);
}

/**
 * Picks a click point inside the target's bounding box, auto-scrolling
 * first when the box isn't in the viewport. See {@link readBoxWithAutoScroll}
 * for the viewport / scroll rules. The picked point uses personality-driven
 * Gaussian spread inside the box; raw-box callers (like {@link executeHover}'s
 * instant mode) bypass this and center on the box directly.
 */
async function resolveLocatorPoint(
  target: Locator | string,
  ctx: MouseContext,
  action: 'click' | 'hover' | 'drag' | 'move',
): Promise<Point> {
  const box = await readBoxWithAutoScroll(target, ctx, action);
  return pickClickPoint(box, ctx.rng, ctx.personality.mouse.clickSpread);
}

/**
 * Reads the target's bounding box, auto-scrolling first when the box is
 * outside the viewport. Returns the (post-scroll, if applicable) box —
 * never null. Throws with the action name baked into the message when the
 * element doesn't exist or vanishes mid-scroll.
 *
 * Why this exists: Playwright's `page.mouse.move/click` use viewport
 * coordinates, not document coordinates. For an element below the fold,
 * `locator.boundingBox()` returns a y > viewport height — dispatching a
 * mouse move to that point lands off-screen and the click silently misses.
 * Real users scroll to bring the element into view before clicking, so we
 * do the same: humanized scroll (`block: 'center'`) in regular speed modes,
 * `scrollIntoViewIfNeeded` snap in `'instant'`.
 *
 * The viewport check uses the box's geometric center: if the center sits
 * inside the visible viewport, the click will land somewhere visible even
 * with personality-driven Gaussian spread, so no scroll fires. This also
 * gracefully handles elements larger than the viewport — the center-in-view
 * rule prevents an impossible "scroll until fully visible" loop.
 *
 * Shared between {@link resolveLocatorPoint} (humanized paths, which then
 * Gaussian-pick a point inside the box) and {@link executeHover}'s
 * instant-mode path (which centers on the box without humanization).
 */
async function readBoxWithAutoScroll(
  target: Locator | string,
  ctx: MouseContext,
  action: 'click' | 'hover' | 'drag' | 'move',
): Promise<BoundingBox> {
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;
  let box = await locator.boundingBox();
  if (!box) {
    throw new Error(
      `Cannot ${action}: element not found or has no bounding box (target: ${describeTarget(target)})`,
    );
  }

  // Playwright returns null from `viewportSize()` when no explicit viewport
  // is set (rare — requires omitting `viewport` from newContext options).
  // In that case we fall back to the pre-fix behavior; nothing better to do
  // without a known viewport size to compare against.
  const viewport = ctx.page.viewportSize();
  if (viewport && !isBoxCenterInViewport(box, viewport)) {
    if (ctx.speed === 'instant') {
      await locator.scrollIntoViewIfNeeded();
    } else {
      // Humanized scroll. `block: 'center'` lands the target in the middle
      // of the viewport, which is what real users do when they're about to
      // interact with something — they scroll until they can comfortably
      // see it, not until it just barely peeks past the edge. `'nearest'`
      // would feel robotic: minimum-scroll places the element right at the
      // viewport boundary, which no human reaches for.
      await executeScroll(locator, ctx, { block: 'center' });
    }
    box = await locator.boundingBox();
    if (!box) {
      throw new Error(
        `Cannot ${action}: element disappeared after scrolling into view (target: ${describeTarget(target)})`,
      );
    }
  }

  return box;
}

/**
 * True when the box's center sits inside the viewport. Center-based rather
 * than corner-based so elements that straddle a viewport edge but have
 * their click target visible don't trigger an unnecessary scroll.
 *
 * Trade-off: for elements larger than the viewport, the Gaussian click
 * point could land outside the visible area in the extreme tail of the
 * distribution. Acceptable because typical `clickSpread` values keep ±3σ
 * well inside any element bigger than the viewport.
 */
function isBoxCenterInViewport(
  box: BoundingBox,
  viewport: { readonly width: number; readonly height: number },
): boolean {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return cx >= 0 && cx <= viewport.width && cy >= 0 && cy <= viewport.height;
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
