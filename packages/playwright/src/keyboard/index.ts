import { type Personality, planTypeKeystrokes, type Rng } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import type { Speed } from '../index';
import { sleep, speedModeFactor } from '../internal/timing';

/** Runtime dependencies for a humanized keyboard action. */
export interface KeyboardContext {
  readonly page: Page;
  readonly personality: Personality;
  readonly rng: Rng;
  readonly speed: Speed;
}

/** Result of a typing action, returned to the caller for observability. */
export interface TypeResult {
  /** Number of characters in the input string. */
  readonly characters: number;
  /** Number of typos injected (with or without correction). */
  readonly typos: number;
  /** Number of typo corrections via Backspace. */
  readonly corrections: number;
}

/**
 * Executes a humanized typing pass over `value` on `target`.
 *
 * Planning (which keys to press, with what delays, in what order) is delegated
 * to `@humanjs/core`'s `planTypeKeystrokes`. This module is the thin Playwright
 * dispatcher: it focuses the target, walks the plan, and chooses the best
 * Playwright API per key:
 *
 *  - Named keys (`Enter`, `Backspace`, `Tab`) and ASCII chars: `keyboard.press`
 *    — fires keydown/press/up, so handlers (autocomplete, validation) run.
 *  - Non-ASCII characters: `keyboard.insertText` — fires `input` events but
 *    not keyboard events, since `keyboard.press` is keyboard-layout-aware
 *    and can't reliably synthesize characters like `é` or `🎉` on every layout.
 *
 * In `speed: 'instant'`, the whole humanized loop is bypassed in favor of
 * `locator.pressSequentially(value, { delay: 0 })` — events still fire,
 * humanization is skipped.
 */
export async function executeType(
  target: Locator | string,
  value: string,
  ctx: KeyboardContext,
): Promise<TypeResult> {
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;

  if (value.length === 0) {
    return { characters: 0, typos: 0, corrections: 0 };
  }

  if (ctx.speed === 'instant') {
    await locator.pressSequentially(value, { delay: 0 });
    return { characters: value.length, typos: 0, corrections: 0 };
  }

  await locator.focus();

  const plan = planTypeKeystrokes(value, ctx.personality.typing, ctx.rng, {
    personalitySpeed: ctx.personality.speed,
    speedFactor: speedModeFactor(ctx.speed),
  });

  let typos = 0;
  let corrections = 0;

  for (const step of plan) {
    if (step.delayBeforeMs > 0) await sleep(step.delayBeforeMs);
    await dispatchKey(ctx.page, step.key);
    if (step.isTypo) typos++;
    if (step.isCorrection) corrections++;
  }

  return { characters: value.length, typos, corrections };
}

/**
 * Dispatches a single planned key. Multi-char strings are treated as named
 * keys (`Enter`, `Backspace`). Single ASCII chars use the layout-aware
 * `keyboard.press`. Single non-ASCII chars fall back to `insertText` so the
 * adapter works on any keyboard layout, at the cost of skipping per-key events.
 */
async function dispatchKey(page: Page, key: string): Promise<void> {
  if (key.length > 1 || key.charCodeAt(0) < 128) {
    await page.keyboard.press(key);
  } else {
    await page.keyboard.insertText(key);
  }
}
