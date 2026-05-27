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
 *  1. Optionally near-miss the grab — with probability
 *     `personality.mouse.misclickProbability`, the cursor first walks to a
 *     point just outside the `from` target (or near it, for raw-Point
 *     `from`), dwells briefly, then approaches the real grab point. No
 *     mousedown fires at the off-target coordinates.
 *  2. Move the cursor to the `from` target along a Bezier path.
 *  3. Press the left mouse button down.
 *  4. Optionally near-miss the drop — independent probability roll, same
 *     visual-only shape: cursor walks to a near-miss point with the
 *     button still held, dwells, then continues to the real drop point.
 *     No mouseup fires at the off-target coordinates. The marginal cost
 *     is a small extra detour through `dragover` events on neighbors,
 *     which is already part of normal drag motion.
 *  5. Walk a fresh Bezier path to `to`, with the button still held. This
 *     is the actual drag motion the page sees.
 *  6. Release the button at `to`.
 *
 * Both endpoints accept a CSS selector, a Locator, or a literal `Point` —
 * the last form is essential for canvas/SVG drags where the destination
 * isn't a DOM element. The grab and drop endpoints roll for misclick
 * independently, so a single drag may near-miss either, both, or neither.
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
  //
  // For both endpoints we also capture the box (if any) so the misclick
  // beats below can pick a near-miss "outside the box" for element-bound
  // targets, or "around the point" for raw-coordinate targets (canvas/SVG).
  const { point: fromPoint, box: fromBox } = await resolveTargetPointAndBox(from, ctx, 'drag');
  const { point: toPoint, box: toBox } = await resolveTargetPointAndBox(to, ctx, 'drag');

  if (ctx.speed === 'instant') {
    await ctx.page.mouse.move(fromPoint.x, fromPoint.y);
    await ctx.page.mouse.down();
    await ctx.page.mouse.move(toPoint.x, toPoint.y);
    await ctx.page.mouse.up();
    ctx.setMousePosition(toPoint);
    return { from: fromPoint, to: toPoint };
  }

  // 1. Maybe near-miss the grab. Same shape as click's misclick beat;
  // `from` commits an action (mousedown), so the misclick principle applies.
  await maybeMisclickBeat(ctx, fromBox, fromPoint);

  // 2. Move to the start of the drag.
  await walkBezierTo(fromPoint, ctx);
  ctx.setMousePosition(fromPoint);

  // 3. Press down. Beat between settling on the source and starting to drag
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

  // 4. Maybe near-miss the drop. Independent roll from the grab — a drag
  // may near-miss the grab, the drop, both, or neither. Same visual-only
  // safety: the cursor wanders near `to` and dwells, but mouseup only
  // fires once the cursor has walked to the real drop point in step 5.
  // Dragover events fire on neighbors during the detour, but they were
  // already firing along the natural drag path — the misclick adds a
  // small extra loop, which is exactly what an exploratory drop attempt
  // looks like in real human use.
  await maybeMisclickBeat(ctx, toBox, toPoint);

  // 5. Walk to the destination with the button still held. `walkBezierTo`
  // generates a fresh humanized path from the cursor's current position
  // (which may be the misclick point from step 4, or `fromPoint` if no
  // misclick fired) to `toPoint`.
  await walkBezierTo(toPoint, ctx);

  // 6. Release. Post-action dwell so the next action doesn't fire in the
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
 *    composed with separate up/down, placement before a keyboard press, or cinematic
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
 *
 * For `'click'` actions, this is also where the misclick beat fires: with
 * probability `personality.mouse.misclickProbability`, the cursor first
 * walks to a point just outside the target's bounding box, dwells briefly
 * (the "oh, I missed" beat), then walks to the real click point. No click
 * is dispatched at the off-target coordinates — the misclick is purely
 * cursor motion, so we never trigger handlers on ancestors or siblings.
 * That keeps the visible humanization signal while making the behavior
 * safe by construction. Hover never misclicks; hovers are about settling
 * on an element, not committing an action.
 */
async function moveToTarget(
  target: Locator | string,
  ctx: MouseContext,
  action: 'click' | 'hover',
): Promise<Point> {
  const box = await readBoxWithAutoScroll(target, ctx, action);
  const targetPoint = pickClickPoint(box, ctx.rng, ctx.personality.mouse.clickSpread);

  // Click commits an action; hover doesn't. Only click gets the misclick beat.
  if (action === 'click') await maybeMisclickBeat(ctx, box, targetPoint);

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
 * Same as {@link resolveTargetPoint} but also returns the bounding box
 * when the target is element-bound. Raw `Point` targets get `box: null` —
 * there's no element, just a coordinate. Used by `executeDrag` so the
 * misclick beat can pick a "near-miss outside the box" for element-bound
 * grabs and a "near-miss around the point" for raw-coordinate grabs.
 */
async function resolveTargetPointAndBox(
  target: MouseTarget,
  ctx: MouseContext,
  action: 'drag',
): Promise<{ point: Point; box: BoundingBox | null }> {
  if (isPoint(target)) return { point: target, box: null };
  const box = await readBoxWithAutoScroll(target, ctx, action);
  const point = pickClickPoint(box, ctx.rng, ctx.personality.mouse.clickSpread);
  return { point, box };
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

/** Range, in CSS pixels, that a misclick lands outside the target's bounding box. */
const MISCLICK_OFFSET_MIN = 5;
const MISCLICK_OFFSET_MAX = 15;

/**
 * Performs the "near-miss" beat shared by `click` and `drag`'s `from`
 * endpoint: with probability `personality.mouse.misclickProbability`, walks
 * the cursor to a point just outside (or near, for raw-Point targets) the
 * commit point, dwells briefly, then returns. The caller continues from
 * wherever the cursor lands — usually with its own walk to the real point.
 *
 * No click is dispatched at the off-target coordinates. The misclick is
 * visible cursor motion only.
 *
 * Two flavors:
 *  - `box` non-null: pick a point just outside one of the four edges.
 *    Used for element-bound targets where "outside the box" has obvious
 *    geometry.
 *  - `box` null: pick a point 5–15 px from the target Point in a random
 *    direction. Used for raw-Point targets (canvas/SVG drags), where there
 *    is no box but the action still commits at a specific coordinate.
 *
 * Skipped (no beat) when the resulting near-miss would have to be clamped
 * back onto the target — better to commit cleanly than fake a degenerate
 * "miss" that lands on the target anyway.
 */
async function maybeMisclickBeat(
  ctx: MouseContext,
  box: BoundingBox | null,
  targetPoint: Point,
): Promise<void> {
  if (!ctx.rng.chance(ctx.personality.mouse.misclickProbability)) return;

  const viewport = ctx.page.viewportSize();
  const misclickPoint = box
    ? pickMisclickOutsideBox(box, ctx.rng, viewport)
    : pickMisclickAroundPoint(targetPoint, ctx.rng, viewport);

  if (misclickPoint === null) return;

  await walkBezierTo(misclickPoint, ctx);
  ctx.setMousePosition(misclickPoint);

  const realizeMs = computeDwellTime(
    ctx.personality.dwell.preClickMs,
    ctx.personality.dwell.preClickJitter,
    ctx.personality,
    ctx.speed,
    ctx.rng,
  );
  if (realizeMs > 0) await sleep(realizeMs);
}

/**
 * Picks a point just outside the target's bounding box — the "near-miss"
 * coordinates the cursor visits before correcting to the real click point.
 *
 * Process:
 *
 *  1. Pick one of the four edges to miss toward (top/right/bottom/left).
 *  2. Pick an outward offset (5–15 px) — far enough to read as a miss,
 *     close enough to read as a correctable wobble.
 *  3. Pick a position along that edge (biased toward the middle 60%, so we
 *     don't miss past a corner where the wobble reads as wild).
 *  4. Clamp to the viewport, since the cursor can't legally land off-screen.
 *  5. If clamping pulled the point back inside the target's box (target sits
 *     at the viewport edge), return `null` — the caller skips the misclick
 *     this round rather than produce a "near-miss" that lands on the target.
 */
function pickMisclickOutsideBox(
  box: BoundingBox,
  rng: Rng,
  viewport: { readonly width: number; readonly height: number } | null,
): Point | null {
  const edge = rng.nextInt(0, 4); // 0=top, 1=right, 2=bottom, 3=left
  const offset = rng.nextFloat(MISCLICK_OFFSET_MIN, MISCLICK_OFFSET_MAX);
  const along = rng.nextFloat(0.2, 0.8);

  let x: number;
  let y: number;
  if (edge === 0) {
    x = box.x + box.width * along;
    y = box.y - offset;
  } else if (edge === 1) {
    x = box.x + box.width + offset;
    y = box.y + box.height * along;
  } else if (edge === 2) {
    x = box.x + box.width * along;
    y = box.y + box.height + offset;
  } else {
    x = box.x - offset;
    y = box.y + box.height * along;
  }

  if (viewport) {
    x = clamp(x, 0, viewport.width - 1);
    y = clamp(y, 0, viewport.height - 1);
  }

  // Clamping pulled the point back inside the box → the misclick is
  // impossible at the viewport edge; skip it rather than fake one.
  const insideBox = x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
  if (insideBox) return null;

  return { x, y };
}

/**
 * Picks a point near (but not on) a raw target coordinate — the no-box
 * analog of {@link pickMisclickOutsideBox}, used for `drag`'s raw-`Point`
 * `from` endpoint (canvas / SVG / pixel-precise targets).
 *
 * Process:
 *  1. Pick a random direction (angle in radians).
 *  2. Pick a distance (5–15 px), same range as the box case.
 *  3. Clamp to the viewport.
 *  4. If clamping pulled the candidate exactly onto the target (target
 *     pinned to the viewport corner with no usable direction), return
 *     `null` so the caller skips the misclick rather than fake one.
 *
 * The target is treated as a zero-sized box: any non-zero offset puts the
 * misclick "outside," which is the right semantic for a pixel-precise
 * action committing at the exact coordinate.
 */
function pickMisclickAroundPoint(
  target: Point,
  rng: Rng,
  viewport: { readonly width: number; readonly height: number } | null,
): Point | null {
  const angle = rng.nextFloat(0, Math.PI * 2);
  const distance = rng.nextFloat(MISCLICK_OFFSET_MIN, MISCLICK_OFFSET_MAX);

  let x = target.x + Math.cos(angle) * distance;
  let y = target.y + Math.sin(angle) * distance;

  if (viewport) {
    x = clamp(x, 0, viewport.width - 1);
    y = clamp(y, 0, viewport.height - 1);
  }

  if (x === target.x && y === target.y) return null;

  return { x, y };
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
