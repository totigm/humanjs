import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { installMouseHelper } from './index';

/**
 * Real-browser integration tests for the cursor overlay. Specifically guards
 * against the regression where `page.setContent()` would wipe the cursor —
 * Playwright doesn't treat setContent as a navigation, so `addInitScript`
 * never re-fires. The helper now also re-injects on `domcontentloaded` AND
 * uses a DOM-element guard (not a window flag) so the re-inject actually
 * adds the cursor element back to the new document.
 *
 * Slow (~3-5s per test, mostly chromium launch); kept in a separate file
 * from the unit tests so the fast mocked tests aren't tied to a browser.
 */

const CURSOR_SELECTOR = '[data-humanjs-cursor]';

describe('installMouseHelper (integration)', () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('installs the cursor on the initial page', async () => {
    const context = await browser.newContext();
    try {
      await installMouseHelper(context);
      const page = await context.newPage();

      const exists = await page.evaluate(
        (sel) => document.querySelector(sel) !== null,
        CURSOR_SELECTOR,
      );
      expect(exists).toBe(true);
    } finally {
      await context.close();
    }
  });

  it('survives page.setContent() — the bug this fix exists for', async () => {
    // Before the fix, setContent wiped the cursor element because:
    //   1. Playwright doesn't fire addInitScript on setContent (only on
    //      navigations like goto), and
    //   2. The in-page idempotency guard was on `window`, which persists
    //      across setContent — so even when the script DID get re-evaluated
    //      via our new domcontentloaded listener, the guard short-circuited.
    // After the fix, the guard checks for the cursor DOM element instead.
    const context = await browser.newContext();
    try {
      await installMouseHelper(context);
      const page = await context.newPage();

      // First setContent — cursor should re-inject via domcontentloaded
      await page.setContent('<html><body style="background:#222">first</body></html>');
      // Brief wait so the async re-inject from the domcontentloaded handler
      // settles before we query.
      await page.waitForTimeout(50);
      expect(
        await page.evaluate((sel) => document.querySelector(sel) !== null, CURSOR_SELECTOR),
      ).toBe(true);

      // Second setContent — same path again, exercises the DOM-element
      // guard explicitly (window guard would have falsely returned "installed")
      await page.setContent('<html><body style="background:#444">second</body></html>');
      await page.waitForTimeout(50);
      expect(
        await page.evaluate((sel) => document.querySelector(sel) !== null, CURSOR_SELECTOR),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

  it('survives page.goto() — the addInitScript path', async () => {
    const context = await browser.newContext();
    try {
      await installMouseHelper(context);
      const page = await context.newPage();

      await page.goto('data:text/html,<html><body>goto</body></html>');
      expect(
        await page.evaluate((sel) => document.querySelector(sel) !== null, CURSOR_SELECTOR),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

  it('installs on pages created AFTER installMouseHelper(context) returned', async () => {
    const context = await browser.newContext();
    try {
      await installMouseHelper(context);

      // Page created after the install — covered by the context-level
      // `context.on('page', ...)` listener that attaches per-page hooks.
      const page = await context.newPage();
      await page.setContent('<html><body>later</body></html>');
      await page.waitForTimeout(50);
      expect(
        await page.evaluate((sel) => document.querySelector(sel) !== null, CURSOR_SELECTOR),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
});
