/**
 * Authoring a community personality.
 *
 * A personality is plain data. To publish one, create a package named
 * `@yourname/personality-<name>` whose entry exports an object exactly like
 * `grandma` below — either a `PersonalityExtension` (a preset + overrides, as
 * here) or a fully built `Personality`. Consumers then do:
 *
 *   import { grandma } from '@yourname/personality-grandma';
 *   await createHuman(page, { personality: grandma });
 *
 * Run this demo:  pnpm --filter @humanjs/examples grandma
 */

import {
  chromium,
  createHuman,
  installMouseHelper,
  type PersonalityExtension,
} from '@humanjs/playwright';

/** Slow, deliberate, curvy — and a bit error-prone. The exact shape a
 *  community `@yourname/personality-grandma` package would export. */
export const grandma: PersonalityExtension = {
  extends: 'careful',
  name: 'grandma',
  speed: 1.7, // everything ~70% slower
  mouse: { curvature: 0.95, travelTimeMs: 1500, overshootProbability: 0.4 },
  typing: {
    baseDelayMs: 240,
    typoProbability: 0.08,
    thinkPauseProbability: 0.4,
    thinkPauseMeanMs: 1000,
  },
  reading: { wpm: 130 },
  dwell: { preClickMs: 650, postActionMs: 800 },
};

const PAGE =
  '<!doctype html><meta charset="utf-8">' +
  '<body style="margin:48px;font-family:sans-serif;font-size:16px">' +
  '<button id="start" style="padding:10px 18px">Start</button>' +
  '<input id="email" placeholder="email" style="display:block;margin-top:18px;padding:8px;width:260px">' +
  '<p style="max-width:340px;margin-top:18px">HumanJS makes browser automation move, type, and read like a real person.</p>' +
  '</body>';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  await installMouseHelper(context);
  const page = await context.newPage();
  await page.setContent(PAGE);

  const human = await createHuman(page, { personality: grandma, seed: 'grandma-demo' });
  await human.click('#start');
  await human.type('#email', 'grandma@example.com');
  await human.read('p');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
