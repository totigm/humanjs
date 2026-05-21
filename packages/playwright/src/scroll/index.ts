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
 *  - `'end'`: scroll to the very bottom of the page.
 *  - `'top'`: scroll to the very top of the page.
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
   */
  readonly block?: 'start' | 'center' | 'end';
}

/** Outcome of a scroll, returned to the caller for observability. */
export interface ScrollResult {
  /** Starting `window.scrollY` value. */
  readonly fromY: number;
  /** Final `window.scrollY` value the scroll aimed for. */
  readonly toY: number;
  /** Signed pixel distance (`toY - fromY`). */
  readonly distance: number;
  /** Total elapsed dwell + motion time in ms. Zero in `speed: 'instant'`. */
  readonly durationMs: number;
}

/** Reserved string targets that select a behavior rather than an element. */
const RESERVED_TARGETS = new Set(['natural', 'end', 'top']);

/**
 * Executes a humanized vertical scroll.
 *
 * Flow:
 *  1. Resolve current scroll position + viewport + document height.
 *  2. Resolve target → final Y.
 *  3. Plan segments via `planScroll`.
 *  4. Walk segments: `sleep(delay) → page.mouse.wheel(0, deltaY)` per step.
 *
 * In `speed: 'instant'`, all humanization is bypassed and the page is
 * scrolled with `window.scrollTo(0, y)` directly.
 */
export async function executeScroll(
  target: ScrollTarget | undefined,
  ctx: ScrollContext,
  options: ScrollOptions = {},
): Promise<ScrollResult> {
  const { page, personality, rng, speed } = ctx;
  const speedFactor = speedModeFactor(speed);

  // Read the page's scroll geometry once up front. Cheaper than evaluating
  // every time we need a number.
  const geom = await page.evaluate(() => ({
    scrollY: window.scrollY,
    viewport: window.innerHeight,
    docHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
  }));

  const fromY = geom.scrollY;
  const toY = await resolveTarget(target, ctx, geom, options.block);
  const clampedTo = clamp(toY, 0, Math.max(0, geom.docHeight - geom.viewport));
  const distance = clampedTo - fromY;

  if (distance === 0) {
    return { fromY, toY: clampedTo, distance: 0, durationMs: 0 };
  }

  if (speed === 'instant') {
    await page.evaluate((y) => window.scrollTo(0, y), clampedTo);
    return { fromY, toY: clampedTo, distance, durationMs: 0 };
  }

  const segments = planScroll(fromY, clampedTo, personality.scroll, rng, {
    forceOvershoot: options.overshoot,
    withPauses: options.withPauses,
    personalitySpeed: personality.speed,
    speedFactor,
  });

  const startedAt = Date.now();
  await walkSegments(page, segments);
  const durationMs = Date.now() - startedAt;

  return { fromY, toY: clampedTo, distance, durationMs };
}

/**
 * Resolves a `ScrollTarget` to an absolute `window.scrollY` value. Element
 * targets evaluate `getBoundingClientRect()` to compute the right Y for
 * the requested `block` alignment.
 */
async function resolveTarget(
  target: ScrollTarget | undefined,
  ctx: ScrollContext,
  geom: { scrollY: number; viewport: number; docHeight: number },
  block: 'start' | 'center' | 'end' = 'start',
): Promise<number> {
  if (target === undefined || target === 'natural') {
    // Scroll exactly one viewport-worth down. This is the contract `'natural'`
    // promises in the docs — fractional multipliers (e.g. 0.85 for "keep
    // some overlap as context") feel like undershooting when the next
    // section sits exactly one viewport away.
    return geom.scrollY + geom.viewport;
  }
  if (target === 'end') return geom.docHeight;
  if (target === 'top') return 0;
  if (typeof target === 'object' && 'by' in target) return geom.scrollY + target.by;
  if (typeof target === 'object' && 'to' in target) return target.to;

  // String selector or Locator from here on.
  const locator =
    typeof target === 'string' && !RESERVED_TARGETS.has(target)
      ? ctx.page.locator(target)
      : typeof target === 'string'
        ? null
        : target;
  if (!locator) {
    // Reserved string fell through the `===` checks above — shouldn't
    // happen, but defensively fall back to natural.
    return geom.scrollY + Math.round(geom.viewport * 0.85);
  }

  const rect = await locator.boundingBox().catch(() => null);
  if (!rect) {
    // Element not found / not visible — best we can do is stay put.
    return geom.scrollY;
  }
  // `rect.y` is viewport-relative; absolute Y is scrollY + rect.y.
  const absoluteTop = geom.scrollY + rect.y;
  if (block === 'start') return absoluteTop;
  if (block === 'end') return absoluteTop + rect.height - geom.viewport;
  // center
  return absoluteTop - (geom.viewport - rect.height) / 2;
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
