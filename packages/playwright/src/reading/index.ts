import {
  computeReadingDwellMs,
  countWords,
  type Personality,
  type ReadKind,
  type Rng,
} from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import type { Speed } from '../index';
import { sleep, speedModeFactor } from '../internal/timing';

/** Runtime dependencies for a humanized reading dwell. */
export interface ReadingContext {
  readonly page: Page;
  readonly personality: Personality;
  readonly rng: Rng;
  readonly speed: Speed;
}

/**
 * What to read:
 *  - `string`: a Playwright-compatible selector (matches `click()` / `type()`).
 *    The element's `innerText` is resolved and word-counted.
 *  - `Locator`: same, but you already have a Locator handle.
 *  - `{ text }`: literal text (you have the string in hand, no selector).
 *  - `{ words }`: pre-counted (bypass extraction entirely).
 */
export type ReadTarget = string | Locator | { readonly text: string } | { readonly words: number };

export interface ReadOptions {
  /**
   * Reading mode. Built-in multipliers on top of `personality.reading.wpm`:
   *  - `'prose'`: 1.0× (default for non-code targets)
   *  - `'code'`:  0.4× (default when target is a `<pre>` or `<code>` element)
   *  - `'scan'`:  1.8× (skim mode, must be explicit)
   *
   * **Smart defaults:** when `kind` is omitted AND the target is a Locator/
   * selector, the adapter inspects the resolved element's tag — `<pre>` and
   * `<code>` auto-detect as `'code'`; everything else as `'prose'`. An
   * explicit `kind` always wins over auto-detection.
   */
  readonly kind?: ReadKind;
  /** Override the effective WPM multiplier directly. Wins over `kind`. */
  readonly wpmMultiplier?: number;
  /**
   * For selector/Locator targets: scroll the element into the viewport
   * before the dwell. A user can't read what isn't on screen. Defaults to
   * `false` — in most flows the caller has already scrolled there.
   */
  readonly scrollIntoView?: boolean;
}

/** Outcome of a read, returned to the caller for observability. */
export interface ReadResult {
  /** Number of words counted (after whitespace splitting / from caller's `{ words }`). */
  readonly words: number;
  /** Sleep duration in ms. Zero in `speed: 'instant'` or for zero-word inputs. */
  readonly durationMs: number;
  /** Final reading kind used (after auto-detection + explicit-override resolution). */
  readonly kind: ReadKind;
}

/**
 * Executes a humanized reading dwell.
 *
 * Flow:
 *  1. Resolve target → words + (optional) Locator
 *  2. Optionally scroll into view
 *  3. Resolve `kind` (explicit → auto-detected from tag → `'prose'`)
 *  4. Compute dwell via `computeReadingDwellMs` (jittered + scaled)
 *  5. Sleep
 *
 * Eye-scan cursor motion during the dwell (`withMotion`) is planned for a
 * follow-up release — see CLAUDE.md "v1 must-have features." The base
 * dwell ships now because it completes the brand's third pillar.
 */
export async function executeRead(
  target: ReadTarget,
  ctx: ReadingContext,
  options: ReadOptions = {},
): Promise<ReadResult> {
  // ── Resolve target → words (+ optional Locator for tag detection / scroll) ─
  let words = 0;
  let locator: Locator | undefined;

  if (typeof target === 'string') {
    locator = ctx.page.locator(target);
  } else if ('words' in target) {
    words = target.words;
  } else if ('text' in target) {
    words = countWords(target.text);
  } else {
    // Only Locator remains in the union after the discriminator checks above.
    locator = target;
  }

  let autoDetectedKind: ReadKind | undefined;

  if (locator) {
    if (options.scrollIntoView) {
      await locator.scrollIntoViewIfNeeded();
    }
    const text = await locator.innerText().catch(() => '');
    words = countWords(text);

    // Auto-detect kind from tag only when caller didn't specify one.
    if (options.kind === undefined) {
      autoDetectedKind = await detectKindFromTag(locator);
    }
  }

  const kind = options.kind ?? autoDetectedKind ?? 'prose';

  const durationMs = computeReadingDwellMs(words, ctx.personality.reading, ctx.rng, {
    kind,
    wpmMultiplier: options.wpmMultiplier,
    personalitySpeed: ctx.personality.speed,
    speedFactor: speedModeFactor(ctx.speed),
  });

  if (durationMs > 0) await sleep(durationMs);

  return { words, durationMs, kind };
}

// ────────── helpers ──────────

/**
 * Inspects the element's tag for the smart default. Only the narrowest
 * heuristic (literal `<pre>` / `<code>` tagName) — CSS class sniffing would
 * be too magical. Returns undefined for anything else, so the caller's
 * resolution chain falls back to `'prose'`.
 */
async function detectKindFromTag(locator: Locator): Promise<ReadKind | undefined> {
  // `evaluate` runs the function in the browser context; Playwright's types
  // give the callback a DOM Element here without needing the lib.dom ref
  // on the Node-side tsconfig.
  const tag = await locator.evaluate((el) => el.tagName?.toLowerCase() ?? '').catch(() => '');
  if (tag === 'pre' || tag === 'code') return 'code';
  return undefined;
}
