import { type Personality, planScroll, type Rng, type ScrollSegment } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import type { Speed } from '../index';
import { sleep, speedModeFactor } from '../internal/timing';

/** Runtime dependencies for a humanized scroll. */
export interface ScrollContext {
  readonly page: Page;
  readonly personality: Personality;
  readonly rng: Rng;
  readonly speed: Speed;
}

/**
 * What / where to scroll:
 *  - `'natural'`: scroll one viewport-worth in the current direction (default).
 *  - `'end'`: scroll to the very bottom.
 *  - `'top'`: scroll to the very top.
 *  - `string`: a Playwright-compatible selector — scroll until in view.
 *  - `Locator`: same, but you already have a Locator handle.
 *  - `{ by: number }`: scroll by a relative pixel delta (negative = up).
 *  - `{ to: number }`: scroll to an absolute Y position.
 */
export type ScrollTarget =
  | 'natural'
  | 'end'
  | 'top'
  | string
  | Locator
  | { readonly by: number }
  | { readonly to: number };

export interface ScrollOptions {
  /**
   * Force an overshoot + correction even if the personality wouldn't choose
   * one. Useful when you want the humanization signal regardless of
   * personality (e.g. demos).
   */
  readonly overshoot?: boolean;
  /**
   * Disable mid-scroll micro-pauses. Defaults to `true` (pauses enabled).
   * Set `false` for the smoothest possible motion.
   */
  readonly withPauses?: boolean;
  /**
   * For element targets only: where to align the element vertically when
   * the scroll ends. Mirrors `scrollIntoView({ block })`. Defaults to
   * `'start'`.
   *
   * - `'start'`: element top aligns with viewport top
   * - `'center'`: element centers in the viewport
   * - `'end'`: element bottom aligns with viewport bottom
   * - `'nearest'`: do the minimum scroll — stay put if element is already
   *    fully visible, otherwise scroll to the closest edge
   */
  readonly block?: 'start' | 'center' | 'end' | 'nearest';
  /**
   * Scroll inside a scrollable container instead of the page. Accepts a
   * Playwright-compatible selector or a built `Locator`. Every scroll
   * semantic (`'natural'`, `'top'`, `'end'`, `{ by }`, `{ to }`, element
   * targets, `block` alignment) applies relative to the container.
   *
   * In humanized speed modes, the cursor moves over the container's
   * center first so the dispatched wheel events target it. In `'instant'`
   * mode, the container's scroll position is set directly with no wheel
   * events.
   *
   * Common use: chat threads, modal bodies, infinite-scroll feeds, any
   * `<div style="overflow-y: auto">` that owns its own scrollbar.
   */
  readonly within?: string | Locator;
  /**
   * Which axis to scroll along. Defaults to `'y'` (vertical).
   *
   * Set `'x'` for horizontal scrolling — carousels, kanban boards,
   * sideways galleries. Every target shape still works: `'natural'`
   * scrolls one viewport-width right, `'top'` jumps to scrollLeft 0,
   * `'end'` to (scrollWidth - clientWidth), `{ by }` / `{ to }` apply to
   * the X-axis, and element targets scroll until the element is visible
   * horizontally.
   */
  readonly axis?: 'x' | 'y';
}

/** Outcome of a scroll, returned to the caller for observability. */
export interface ScrollResult {
  /** Starting scroll position along the chosen axis. */
  readonly fromY: number;
  /** Final scroll position the scroll aimed for, along the chosen axis. */
  readonly toY: number;
  /** Signed pixel distance (`toY - fromY`). */
  readonly distance: number;
  /** Total elapsed dwell + motion time in ms. Zero in `speed: 'instant'`. */
  readonly durationMs: number;
}

/** Reserved string targets that select a behavior rather than an element. */
const RESERVED_TARGETS = new Set(['natural', 'end', 'top']);

/**
 * Generic axis description — the planner doesn't care whether it's driving
 * `window.scrollY` or an element's `scrollTop`. Both look like the same
 * 1-D problem: a current position, a viewport length, and a max scrollable
 * extent.
 */
interface ScrollGeometry {
  /** Current scroll position. */
  readonly current: number;
  /** Visible length (viewport height for window, clientHeight for container). */
  readonly viewport: number;
  /** Total scrollable extent (docHeight for window, scrollHeight for container). */
  readonly total: number;
  /**
   * For container scrolls: viewport-relative center coordinates the cursor
   * should hover over so wheel events target the container. Undefined for
   * window scrolls (mouse position doesn't affect window scroll routing).
   */
  readonly hover?: { x: number; y: number };
}

/**
 * Executes a humanized scroll on either the page or a scrollable container,
 * along the chosen axis.
 *
 * Flow:
 *  1. Resolve the scroll axis: page (default) or a container if `within` is set.
 *  2. Read current position + viewport + total geometry for that axis +
 *     direction (X or Y).
 *  3. Resolve target → final position on that axis.
 *  4. Plan segments via `planScroll`.
 *  5. For containers in humanized mode, park the cursor over the container
 *     so wheel events target it. Then walk segments via `page.mouse.wheel`,
 *     mapping each segment's `delta` onto the chosen axis.
 *
 * In `speed: 'instant'`, all humanization is bypassed:
 *  - Page scrolls call `window.scrollTo(...)` with the new position on the
 *    chosen axis and the existing position on the other.
 *  - Container scrolls evaluate `el.scrollTo(...)` with the same shape.
 */
export async function executeScroll(
  target: ScrollTarget | undefined,
  ctx: ScrollContext,
  options: ScrollOptions = {},
): Promise<ScrollResult> {
  const { page, personality, rng, speed } = ctx;
  const speedFactor = speedModeFactor(speed);
  const axis: 'x' | 'y' = options.axis ?? 'y';

  const container = resolveWithin(options.within, ctx);
  const geom = container
    ? await readContainerGeometry(container, axis)
    : await readWindowGeometry(page, axis);
  if (!geom) {
    // Container not found / not scrollable — nothing to do.
    return { fromY: 0, toY: 0, distance: 0, durationMs: 0 };
  }

  const fromY = geom.current;
  const toY = await resolveTarget(target, ctx, geom, container, axis, options.block);
  const clampedTo = clamp(toY, 0, Math.max(0, geom.total - geom.viewport));
  const distance = clampedTo - fromY;

  if (distance === 0) {
    return { fromY, toY: clampedTo, distance: 0, durationMs: 0 };
  }

  if (speed === 'instant') {
    if (container) {
      await container.evaluate(
        (el, args) => {
          const a = args as { axis: 'x' | 'y'; pos: number };
          if (a.axis === 'x') el.scrollTo(a.pos, el.scrollTop);
          else el.scrollTo(el.scrollLeft, a.pos);
        },
        { axis, pos: clampedTo },
      );
    } else {
      await page.evaluate(
        (args) => {
          if (args.axis === 'x') window.scrollTo(args.pos, window.scrollY);
          else window.scrollTo(window.scrollX, args.pos);
        },
        { axis, pos: clampedTo },
      );
    }
    return { fromY, toY: clampedTo, distance, durationMs: 0 };
  }

  const segments = planScroll(fromY, clampedTo, personality.scroll, rng, {
    forceOvershoot: options.overshoot,
    withPauses: options.withPauses,
    personalitySpeed: personality.speed,
    speedFactor,
  });

  // For container scrolls, park the cursor over the container so wheel
  // events route to it instead of the page.
  if (container && geom.hover) {
    await page.mouse.move(geom.hover.x, geom.hover.y);
  }

  const startedAt = Date.now();
  await walkSegments(page, segments, axis);
  const durationMs = Date.now() - startedAt;

  return { fromY, toY: clampedTo, distance, durationMs };
}

/** Coerces the `within` option into a Locator (or null when unset). */
function resolveWithin(within: ScrollOptions['within'], ctx: ScrollContext): Locator | null {
  if (!within) return null;
  return typeof within === 'string' ? ctx.page.locator(within) : within;
}

/** Reads the page's current scroll geometry for the chosen axis. */
async function readWindowGeometry(page: Page, axis: 'x' | 'y'): Promise<ScrollGeometry> {
  const g = await page.evaluate((a: 'x' | 'y') => {
    if (a === 'x') {
      return {
        current: window.scrollX,
        viewport: window.innerWidth,
        total: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
      };
    }
    return {
      current: window.scrollY,
      viewport: window.innerHeight,
      total: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    };
  }, axis);
  return { current: g.current, viewport: g.viewport, total: g.total };
}

/**
 * Reads container scroll geometry for the chosen axis plus the center of
 * its viewport-relative bounding box (for cursor parking). Returns `null`
 * if the element resolves to nothing.
 */
async function readContainerGeometry(
  container: Locator,
  axis: 'x' | 'y',
): Promise<ScrollGeometry | null> {
  return container
    .evaluate((el, a: 'x' | 'y') => {
      const rect = el.getBoundingClientRect();
      const isX = a === 'x';
      return {
        current: isX ? el.scrollLeft : el.scrollTop,
        viewport: isX ? el.clientWidth : el.clientHeight,
        total: isX ? el.scrollWidth : el.scrollHeight,
        hover: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      } as const;
    }, axis)
    .catch(() => null);
}

/**
 * Resolves a `ScrollTarget` to an absolute scroll position on the active
 * axis (window scroll or container scroll, vertical or horizontal).
 */
async function resolveTarget(
  target: ScrollTarget | undefined,
  ctx: ScrollContext,
  geom: ScrollGeometry,
  container: Locator | null,
  axis: 'x' | 'y',
  block: 'start' | 'center' | 'end' | 'nearest' = 'start',
): Promise<number> {
  if (target === undefined || target === 'natural') return geom.current + geom.viewport;
  if (target === 'end') return geom.total;
  if (target === 'top') return 0;
  if (typeof target === 'object' && 'by' in target) return geom.current + target.by;
  if (typeof target === 'object' && 'to' in target) return target.to;

  // Element target — selector string or Locator.
  const elementLocator =
    typeof target === 'string' && !RESERVED_TARGETS.has(target)
      ? ctx.page.locator(target)
      : typeof target === 'string'
        ? null
        : target;
  if (!elementLocator) return geom.current + geom.viewport;

  return container
    ? resolveElementWithinContainer(elementLocator, container, geom, axis, block)
    : resolveElementInWindow(elementLocator, geom, axis, block);
}

/**
 * Computes the scroll position needed to align a window-level element per
 * `block` along the chosen axis. `rect.x` / `rect.y` are viewport-relative;
 * absolute position is `geom.current + rect.{axis}`.
 */
async function resolveElementInWindow(
  elementLocator: Locator,
  geom: ScrollGeometry,
  axis: 'x' | 'y',
  block: 'start' | 'center' | 'end' | 'nearest',
): Promise<number> {
  const rect = await elementLocator.boundingBox().catch(() => null);
  if (!rect) return geom.current;
  const relStart = axis === 'x' ? rect.x : rect.y;
  const length = axis === 'x' ? rect.width : rect.height;
  const absoluteStart = geom.current + relStart;
  const absoluteEnd = absoluteStart + length;
  if (block === 'start') return absoluteStart;
  if (block === 'end') return absoluteEnd - geom.viewport;
  if (block === 'nearest') {
    if (relStart >= 0 && relStart + length <= geom.viewport) return geom.current;
    if (relStart < 0) return absoluteStart;
    return absoluteEnd - geom.viewport;
  }
  return absoluteStart - (geom.viewport - length) / 2;
}

/**
 * Computes the container's `scrollTop` / `scrollLeft` needed to align an
 * element per `block` along the chosen axis. Element offset from the
 * container's content origin =
 *   `(element.rect.{axis} - container.rect.{axis}) + container.scroll{axis}`
 * regardless of whether the container is the element's positioning ancestor.
 */
async function resolveElementWithinContainer(
  elementLocator: Locator,
  container: Locator,
  geom: ScrollGeometry,
  axis: 'x' | 'y',
  block: 'start' | 'center' | 'end' | 'nearest',
): Promise<number> {
  const rects = await container
    .evaluate(
      (containerEl, args: { sel: string | null; axis: 'x' | 'y' }) => {
        const elementEl = args.sel ? document.querySelector(args.sel) : null;
        // The element may not be a child of the container — handle that too.
        const targetEl = elementEl ?? (containerEl.querySelector(':scope > *') as Element | null);
        if (!targetEl) return null;
        const cRect = containerEl.getBoundingClientRect();
        const eRect = targetEl.getBoundingClientRect();
        return args.axis === 'x'
          ? { relStart: eRect.left - cRect.left, length: eRect.width }
          : { relStart: eRect.top - cRect.top, length: eRect.height };
      },
      { sel: await locatorSelector(elementLocator), axis },
    )
    .catch(() => null);
  if (!rects) return geom.current;
  // Offset from container's content origin = (visual delta) + scroll position.
  const offsetStart = rects.relStart + geom.current;
  const offsetEnd = offsetStart + rects.length;
  if (block === 'start') return offsetStart;
  if (block === 'end') return offsetEnd - geom.viewport;
  if (block === 'nearest') {
    if (rects.relStart >= 0 && rects.relStart + rects.length <= geom.viewport) {
      return geom.current;
    }
    if (rects.relStart < 0) return offsetStart;
    return offsetEnd - geom.viewport;
  }
  return offsetStart - (geom.viewport - rects.length) / 2;
}

/**
 * Best-effort recovery of the selector string a Locator wraps. Playwright's
 * `Locator.toString()` returns something like `locator('css=#foo')` — we
 * strip the wrapper to get the inner selector. Falls back to `null` when
 * the format isn't recognized; the caller treats that as "no element."
 */
async function locatorSelector(locator: Locator): Promise<string | null> {
  const s = locator.toString?.();
  if (typeof s !== 'string') return null;
  const match = /locator\(['"](.+?)['"]/.exec(s);
  if (!match) return null;
  const raw = match[1] ?? '';
  // Strip an "engine=" prefix when present (Playwright sometimes prepends one).
  const eq = raw.indexOf('=');
  return eq > 0 && /^[a-z]+$/.test(raw.slice(0, eq)) ? raw.slice(eq + 1) : raw;
}

/** Walks the planned segments, dispatching wheel events on the chosen axis. */
async function walkSegments(
  page: Page,
  segments: readonly ScrollSegment[],
  axis: 'x' | 'y',
): Promise<void> {
  for (const segment of segments) {
    if (segment.delayBeforeMs > 0) await sleep(segment.delayBeforeMs);
    if (segment.delta !== 0) {
      if (axis === 'x') await page.mouse.wheel(segment.delta, 0);
      else await page.mouse.wheel(0, segment.delta);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
