/**
 * Playwright Test integration — opt-in via the `@humanjs/playwright/test`
 * subpath. Re-exports `test` / `expect` from `@playwright/test` with a
 * pre-wired `human` fixture, so a spec never hand-rolls `createHuman`.
 *
 * Each test gets a {@link Human} bound to its `page`, **seeded from the test
 * title** (deterministic per test, so snapshots stay stable) and **instant in
 * CI / humanized locally** (fast pipelines, real-pace runs at your desk).
 * Override any of that per-file or per-project with the `humanOptions` option.
 *
 * `@playwright/test` is an optional peer — it's how you run Playwright tests,
 * so the host already provides it. Keeping the fixture on a subpath means the
 * package root never pulls in the test runner.
 *
 * @example
 * ```ts
 * import { test, expect } from '@humanjs/playwright/test';
 *
 * test('checkout', async ({ human, page }) => {
 *   await human.goto('/cart');
 *   await human.click('Checkout');
 *   await expect(page).toHaveURL(/success/);
 * });
 *
 * // Customize for a file (or a whole project via playwright.config.ts):
 * test.use({ humanOptions: { personality: 'distracted', speed: 'human' } });
 * ```
 */

import { test as base } from '@playwright/test';
import { type CreateHumanOptions, createHuman, type Human } from '../index';

/** Test-scoped fixtures added by `@humanjs/playwright/test`. */
export interface HumanFixtures {
  /**
   * A {@link Human} bound to the test's `page`. Created fresh per test; by
   * default seeded from the test title and run instant in CI, humanized
   * locally. Tune via the `humanOptions` option.
   */
  human: Human;
}

/** Option fixture to customize the per-test {@link Human}. */
export interface HumanOptions {
  /**
   * Options forwarded to `createHuman` for the `human` fixture. Set with
   * `test.use({ humanOptions: { … } })` (per file) or in `playwright.config.ts`
   * `use` (per project). Defaults: `seed` = the test title, `speed` =
   * `'instant'` in CI else `'human'`. Anything you set here overrides those.
   */
  humanOptions: CreateHumanOptions;
}

/**
 * Playwright `test` extended with the `human` fixture. Drop-in replacement
 * for `@playwright/test`'s `test`.
 */
export const test = base.extend<HumanFixtures & HumanOptions>({
  humanOptions: [{}, { option: true }],
  human: async ({ page, humanOptions }, use, testInfo) => {
    const human = await createHuman(page, {
      // Deterministic per test, CI-fast by default — both overridable since
      // the spread comes last.
      seed: testInfo.title,
      speed: process.env.CI ? 'instant' : 'human',
      // No cursor overlay in CI (instant) so it never lands in test DOM or
      // screenshots; shown locally where you actually watch the run.
      cursor: !process.env.CI,
      ...humanOptions,
    });
    await use(human);
  },
});

export { expect } from '@playwright/test';
