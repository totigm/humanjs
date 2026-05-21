import {
  type ActionResult,
  createRng,
  type HumanAction,
  type HumanPlugin,
  type Personality,
  type PersonalityConfig,
  type PluginContext,
  type Point,
  resolvePersonality,
} from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import { executeType } from './keyboard';
import { executeClick } from './mouse';
import { executeRead, type ReadOptions, type ReadTarget } from './reading';

export type {
  ActionResult,
  ActionType,
  BezierPathOptions,
  ComputeReadingDwellOptions,
  DwellProfile,
  HumanAction,
  HumanizePathOptions,
  HumanPlugin,
  Keystroke,
  KnownActionType,
  MouseProfile,
  Personality,
  PersonalityConfig,
  PersonalityExtension,
  PlanTypingOptions,
  PluginContext,
  Point,
  PresetName,
  ReadingProfile,
  ReadKind,
  Rng,
  TypingProfile,
} from '@humanjs/core';
// Re-exports of the public core API so consumers have one import surface.
export {
  applyMicroJitter,
  applyVelocityProfile,
  bezierPath,
  blend,
  careful,
  computeReadingDwellMs,
  countWords,
  createRng,
  distracted,
  fast,
  humanizePath,
  planTypeKeystrokes,
  precise,
  resolvePersonality,
} from '@humanjs/core';
export type { ReadOptions, ReadResult, ReadTarget } from './reading';

/**
 * How fast the humanized session runs.
 * - `'human'` — full humanization (default)
 * - `'fast'` — humanized but accelerated
 * - `'instant'` — bypass all humanization, straight Playwright
 */
export type Speed = 'fast' | 'human' | 'instant';

/** Options for {@link createHuman}. */
export interface CreateHumanOptions {
  /** Personality preset, extension, or fully built personality. Defaults to `'careful'`. */
  readonly personality?: PersonalityConfig;
  /** Seed for the session's PRNG. Same seed produces identical trajectories. */
  readonly seed?: number | string;
  /** Speed mode. Defaults to `'human'`. */
  readonly speed?: Speed;
  /** Plugins installed on this session, invoked in registration order. */
  readonly plugins?: readonly HumanPlugin[];
  /**
   * Starting cursor position used as the origin of the first humanized path.
   * Defaults to `{ x: 0, y: 0 }`. Set this if you've already moved the cursor
   * (e.g. via `page.mouse.move`) before creating the session, so the first
   * click's path starts from the correct location.
   */
  readonly initialMousePosition?: Point;
}

/** A humanized Playwright session bound to a single `Page`. */
export interface Human {
  /** The resolved personality this session is using. */
  readonly personality: Personality;
  /** The speed mode this session was created with. */
  readonly speed: Speed;
  /**
   * Navigate to `url`. Plugins observe the action via `'goto'`; the underlying
   * `page.goto(url)` is awaited unchanged.
   */
  goto(url: string): Promise<void>;
  /**
   * Move the mouse along a humanized Bezier path to `target` and click.
   *
   * `target` accepts either a Playwright-compatible selector string (e.g.
   * `'button:has-text("Buy now")'`) or a built `Locator`. The click point
   * inside the element is Gaussian-distributed around the center.
   *
   * In `speed: 'instant'`, all humanization is skipped and Playwright's
   * native `locator.click()` is used directly.
   */
  click(target: Locator | string): Promise<void>;
  /**
   * Type `value` into `target` with humanized per-key timing, optional typo
   * injection (with backspace recovery), and occasional think-pauses.
   *
   * Per-key `keydown`/`press`/`up` events fire for each character, so
   * handlers like autocomplete dropdowns still receive every keystroke.
   *
   * In `speed: 'instant'`, falls back to `locator.pressSequentially` with
   * zero inter-key delay — events still fire, but humanization is skipped.
   */
  type(target: Locator | string, value: string): Promise<void>;
  /**
   * Dwell as if reading `target` — the third pillar of humanization after
   * the cursor and the keyboard. Real users pause to read; HumanJS models
   * that pause from word count + the personality's reading WPM (+ jitter).
   *
   * **Targets:**
   *  - `string`: a Playwright-compatible selector (matches `click()`/`type()`).
   *  - `Locator`: a pre-built Locator.
   *  - `{ text }`: literal text in hand (no DOM lookup).
   *  - `{ words }`: pre-counted — skip text extraction entirely.
   *
   * **Smart defaults** (only when the caller doesn't override):
   *  - `kind` auto-detects as `'code'` for `<pre>` and `<code>` tags;
   *    everything else falls back to `'prose'`. Explicit `kind` always wins.
   *  - `scrollIntoView: false` — most flows already scrolled to the content.
   *
   * Plugins observe `'read'` actions with `{ target, words, kind }` in params.
   * The text content itself is never echoed — passwords, tokens, and other
   * sensitive strings stay out of telemetry by default.
   *
   * In `speed: 'instant'`, dwell collapses to 0 ms but the action still fires
   * so observability stays consistent.
   */
  read(target: ReadTarget, options?: ReadOptions): Promise<void>;
}

/**
 * Creates a humanized session bound to a Playwright `Page`.
 *
 * @example
 * ```ts
 * import { chromium } from 'playwright';
 * import { createHuman } from '@humanjs/playwright';
 *
 * const browser = await chromium.launch();
 * const page = await browser.newPage();
 *
 * const human = await createHuman(page, {
 *   personality: 'careful',
 *   seed: 'session-42',
 * });
 *
 * await human.goto('https://example.com');
 * ```
 */
export async function createHuman(page: Page, options: CreateHumanOptions = {}): Promise<Human> {
  const personality = resolvePersonality(options.personality ?? 'careful');
  const rng = createRng(options.seed);
  const speed = options.speed ?? 'human';
  const plugins = options.plugins ?? [];

  const context: PluginContext = { personality, rng };
  for (const plugin of plugins) {
    await plugin.install?.(context);
  }

  async function performAction<T>(action: HumanAction, actionFn: () => Promise<T>): Promise<T> {
    for (const plugin of plugins) {
      await plugin.beforeAction?.(action);
    }
    const startedAt = Date.now();
    try {
      const value = await actionFn();
      const result: ActionResult = {
        type: action.type,
        durationMs: Date.now() - startedAt,
      };
      for (const plugin of plugins) {
        await plugin.afterAction?.(action, result);
      }
      return value;
    } catch (error) {
      for (const plugin of plugins) {
        await plugin.onError?.(action, error);
      }
      throw error;
    }
  }

  let lastMousePosition: Point = options.initialMousePosition ?? { x: 0, y: 0 };

  return {
    personality,
    speed,
    async goto(url) {
      await performAction({ type: 'goto', params: { url } }, async () => {
        await page.goto(url);
      });
    },
    async click(target) {
      const description = typeof target === 'string' ? target : (target.toString?.() ?? 'locator');
      await performAction({ type: 'click', params: { target: description } }, async () => {
        await executeClick(target, {
          page,
          personality,
          rng,
          speed,
          getMousePosition: () => lastMousePosition,
          setMousePosition: (point) => {
            lastMousePosition = point;
          },
        });
      });
    },
    async type(target, value) {
      const description = typeof target === 'string' ? target : (target.toString?.() ?? 'locator');
      // `value` itself is intentionally not echoed into params — typed input may
      // be sensitive (passwords, tokens). Expose length only for observability.
      await performAction(
        { type: 'type', params: { target: description, length: value.length } },
        async () => {
          await executeType(target, value, { page, personality, rng, speed });
        },
      );
    },
    async read(target, options) {
      const description = describeReadTarget(target);
      // Same privacy posture as `type`: never echo arbitrary content into
      // action params. `target` description, words (when known up front), and
      // kind are inert metadata; the text itself never lands here.
      await performAction(
        {
          type: 'read',
          params: {
            target: description,
            kind: options?.kind,
          },
        },
        async () => {
          await executeRead(target, { page, personality, rng, speed }, options);
        },
      );
    },
  };
}

/**
 * Human-readable description of a read target for action params. Echoes
 * selectors and `{ words }` (both inert); abbreviates literal text to its
 * length so we never expose content even via accidental logging.
 */
function describeReadTarget(target: ReadTarget): string {
  if (typeof target === 'string') return target;
  if ('words' in target && typeof target.words === 'number') return `${target.words} words`;
  if ('text' in target && typeof target.text === 'string') {
    return `text:${target.text.length} chars`;
  }
  return target.toString?.() ?? 'locator';
}
