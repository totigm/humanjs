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
   * mode, the container's `scrollTop` is set directly with no wheel events.
   *
   * Common use: chat threads, modal bodies, infinite-scroll feeds, any
   * `<div style="overflow-y: auto">` that owns its own scrollbar.
   */
  readonly within?: string | Locator;
}

/** Outcome of a scroll, returned to the caller for observability. */
export interface ScrollResult {
  /** Starting scroll position (`window.scrollY` or `container.scrollTop`). */
  readonly fromY: number;
  /** Final scroll position the scroll aimed for. */
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
 * Executes a humanized vertical scroll on either the page or a scrollable
 * container.
 *
 * Flow:
 *  1. Resolve the scroll axis: page (default) or a container if `within` is set.
 *  2. Read current position + viewport + total geometry for that axis.
 *  3. Resolve target → final position on that axis.
 *  4. Plan segments via `planScroll`.
 *  5. For containers in humanized mode, park the cursor over the container
 *     so wheel events target it. Then walk segments via `page.mouse.wheel`.
 *
 * In `speed: 'instant'`, all humanization is bypassed:
 *  - Page scrolls call `window.scrollTo(0, y)`.
 *  - Container scrolls evaluate `el.scrollTo(0, y)` on the element.
 */
export async function executeScroll(
  target: ScrollTarget | undefined,
  ctx: ScrollContext,
  options: ScrollOptions = {},
): Promise<ScrollResult> {
  const { page, personality, rng, speed } = ctx;
  const speedFactor = speedModeFactor(speed);

  const container = resolveWithin(options.within, ctx);
  const geom = container ? await readContainerGeometry(container) : await readWindowGeometry(page);
  if (!geom) {
    // Container not found / not scrollable — nothing to do.
    return { fromY: 0, toY: 0, distance: 0, durationMs: 0 };
  }

  const fromY = geom.current;
  const toY = await resolveTarget(target, ctx, geom, container, options.block);
  const clampedTo = clamp(toY, 0, Math.max(0, geom.total - geom.viewport));
  const distance = clampedTo - fromY;

  if (distance === 0) {
    return { fromY, toY: clampedTo, distance: 0, durationMs: 0 };
  }

  if (speed === 'instant') {
    if (container) {
      await container.evaluate((el, y) => el.scrollTo(0, y as number), clampedTo);
    } else {
      await page.evaluate((y) => window.scrollTo(0, y), clampedTo);
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
  await walkSegments(page, segments);
  const durationMs = Date.now() - startedAt;

  return { fromY, toY: clampedTo, distance, durationMs };
}

/** Coerces the `within` option into a Locator (or null when unset). */
function resolveWithin(within: ScrollOptions['within'], ctx: ScrollContext): Locator | null {
  if (!within) return null;
  return typeof within === 'string' ? ctx.page.locator(within) : within;
}

/** Reads `window.scrollY` / `innerHeight` / `documentElement.scrollHeight`. */
async function readWindowGeometry(page: Page): Promise<ScrollGeometry> {
  const g = await page.evaluate(() => ({
    current: window.scrollY,
    viewport: window.innerHeight,
    total: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
  }));
  return { current: g.current, viewport: g.viewport, total: g.total };
}

/**
 * Reads container `scrollTop` / `clientHeight` / `scrollHeight` plus the
 * center of its viewport-relative bounding box (for cursor parking).
 * Returns `null` if the element resolves to nothing.
 */
async function readContainerGeometry(container: Locator): Promise<ScrollGeometry | null> {
  return container
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        current: el.scrollTop,
        viewport: el.clientHeight,
        total: el.scrollHeight,
        hover: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      } as const;
    })
    .catch(() => null);
}

/**
 * Resolves a `ScrollTarget` to an absolute scroll position on the active
 * axis (either `window.scrollY` or the container's `scrollTop`).
 */
async function resolveTarget(
  target: ScrollTarget | undefined,
  ctx: ScrollContext,
  geom: ScrollGeometry,
  container: Locator | null,
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
    ? resolveElementWithinContainer(elementLocator, container, geom, block)
    : resolveElementInWindow(elementLocator, geom, block);
}

/**
 * Computes the scrollY needed to align a window-level element per `block`.
 * `rect.y` is viewport-relative; absolute Y is `scrollY + rect.y`.
 */
async function resolveElementInWindow(
  elementLocator: Locator,
  geom: ScrollGeometry,
  block: 'start' | 'center' | 'end' | 'nearest',
): Promise<number> {
  const rect = await elementLocator.boundingBox().catch(() => null);
  if (!rect) return geom.current;
  const absoluteTop = geom.current + rect.y;
  const absoluteBottom = absoluteTop + rect.height;
  if (block === 'start') return absoluteTop;
  if (block === 'end') return absoluteBottom - geom.viewport;
  if (block === 'nearest') {
    if (rect.y >= 0 && rect.y + rect.height <= geom.viewport) return geom.current;
    if (rect.y < 0) return absoluteTop;
    return absoluteBottom - geom.viewport;
  }
  return absoluteTop - (geom.viewport - rect.height) / 2;
}

/**
 * Computes the container's `scrollTop` needed to align an element per `block`.
 * Element offset from the container's content origin =
 *   `(element.rect.y - container.rect.y) + container.scrollTop`
 * regardless of whether the container is the element's positioning ancestor.
 */
async function resolveElementWithinContainer(
  elementLocator: Locator,
  container: Locator,
  geom: ScrollGeometry,
  block: 'start' | 'center' | 'end' | 'nearest',
): Promise<number> {
  const rects = await container
    .evaluate(
      (containerEl, sel) => {
        const elementEl = sel ? document.querySelector(sel) : null;
        // The element may not be a child of the container — handle that too.
        const targetEl = elementEl ?? (containerEl.querySelector(':scope > *') as Element | null);
        if (!targetEl) return null;
        const cRect = containerEl.getBoundingClientRect();
        const eRect = targetEl.getBoundingClientRect();
        return {
          elementY: eRect.top - cRect.top,
          elementHeight: eRect.height,
        };
      },
      await locatorSelector(elementLocator),
    )
    .catch(() => null);
  if (!rects) return geom.current;
  // Offset from container's content origin = (visual delta) + container.scrollTop.
  const offsetTop = rects.elementY + geom.current;
  const offsetBottom = offsetTop + rects.elementHeight;
  if (block === 'start') return offsetTop;
  if (block === 'end') return offsetBottom - geom.viewport;
  if (block === 'nearest') {
    if (rects.elementY >= 0 && rects.elementY + rects.elementHeight <= geom.viewport) {
      return geom.current;
    }
    if (rects.elementY < 0) return offsetTop;
    return offsetBottom - geom.viewport;
  }
  return offsetTop - (geom.viewport - rects.elementHeight) / 2;
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

/** Walks the planned segments, dispatching wheel events with pacing. */
async function walkSegments(page: Page, segments: readonly ScrollSegment[]): Promise<void> {
  for (const segment of segments) {
    if (segment.delayBeforeMs > 0) await sleep(segment.delayBeforeMs);
    if (segment.deltaY !== 0) await page.mouse.wheel(0, segment.deltaY);
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
