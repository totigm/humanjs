import {
  type ActionResult,
  createRng,
  type HumanAction,
  type HumanPlugin,
  type Personality,
  type PersonalityConfig,
  type PluginContext,
  resolvePersonality,
} from '@humanjs/core';
import type { Page } from 'playwright';

export type {
  ActionResult,
  ActionType,
  BezierPathOptions,
  DwellProfile,
  HumanAction,
  HumanizePathOptions,
  HumanPlugin,
  KnownActionType,
  MouseProfile,
  Personality,
  PersonalityConfig,
  PersonalityExtension,
  PluginContext,
  Point,
  PresetName,
  ReadingProfile,
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
  createRng,
  distracted,
  fast,
  humanizePath,
  precise,
  resolvePersonality,
} from '@humanjs/core';

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

  return {
    personality,
    speed,
    async goto(url) {
      await performAction({ type: 'goto', params: { url } }, async () => {
        await page.goto(url);
      });
    },
  };
}
