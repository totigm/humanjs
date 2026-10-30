/**
 * `humanjs demo <url>` — the ten-second look at what the library does.
 *
 * Someone evaluating HumanJS should not have to write code to find out
 * whether the motion is convincing. This drives a real page the way a
 * person would skim it: land, read the heading, scroll in stages, drift
 * the cursor over something clickable.
 *
 * It runs against an arbitrary URL, so every step here is defensive —
 * a page may have no heading, no links, or nothing to scroll. Each step
 * is skipped rather than fatal, because a demo that crashes on someone
 * else's site is worse than one that does slightly less on it.
 */

import { chromium, createHuman, type Human, installMouseHelper } from '@humanjs/playwright';
import { record } from '@humanjs/recorder';
import type { Locator, Page } from 'playwright';
import type { CliOptions } from '../args';

/**
 * First of `selectors` that resolves to something visible, as a locator
 * already narrowed with `.first()`.
 *
 * Returning a locator rather than the selector string is the whole point:
 * on a real page `a[href]` matches dozens of elements, and handing that
 * string to a primitive trips Playwright's strict mode and hangs until it
 * times out. Narrowing here means the caller cannot make that mistake.
 */
async function firstVisible(page: Page, selectors: readonly string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible()) return locator;
    } catch {
      // An invalid or unsupported selector on an exotic page: try the next.
    }
  }
  return null;
}

/**
 * Whether the document is tall enough that scrolling means anything.
 *
 * Measured by comparing the body box to the viewport rather than through
 * `page.evaluate`: the repo's tsconfig carries no DOM lib, so reaching for
 * `document` here would mean widening it for one predicate.
 */
async function isScrollable(page: Page): Promise<boolean> {
  try {
    const viewport = page.viewportSize();
    if (!viewport) return false;
    const box = await page.locator('body').boundingBox();
    return box !== null && box.height > viewport.height + 100;
  } catch {
    return false;
  }
}

async function tour(human: Human, page: Page, url: string): Promise<void> {
  await human.goto(url);
  await human.sleep(600);

  const heading = await firstVisible(page, ['h1', 'h2', 'main p', 'article p', 'p']);
  if (heading) {
    await human.read(heading);
    await human.sleep(300);
  }

  if (await isScrollable(page)) {
    // Three passes rather than one: the pause between them is where the
    // motion reads as a person deciding whether to keep going.
    for (let i = 0; i < 3; i += 1) {
      await human.scroll('natural');
      await human.sleep(500);
    }
  }

  const clickable = await firstVisible(page, ['a[href]', 'button', '[role="button"]']);
  if (clickable) {
    // Hover, never click: this runs on someone else's site and must not
    // navigate away, submit anything, or trigger a side effect.
    await human.hover(clickable);
    await human.sleep(700);
  }
}

export async function runDemo(url: string, options: CliOptions): Promise<void> {
  const { personality, speed, seed, headless, viewport, record: output } = options;

  if (output) {
    const rec = await record(
      { output, name: `humanjs demo ${url}`, personality, seed, viewport, headless },
      async (human, page) => {
        await tour(human, page, url);
      },
    );
    console.log(`Recorded ${rec.timeline.events.length} actions to ${output}`);
    return;
  }

  const browser = await chromium.launch({ headless });
  try {
    const context = await browser.newContext({ viewport });
    await installMouseHelper(context);
    const page = await context.newPage();
    const human = await createHuman(page, { personality, speed, seed });
    await tour(human, page, url);
  } finally {
    await browser.close();
  }
}
