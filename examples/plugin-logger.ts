/**
 * Writing a plugin.
 *
 * A plugin is a plain object with optional lifecycle hooks. The host calls
 * them around every humanized action — observation only in v1 (hooks can't
 * transform actions). Pass plugins when creating a session:
 *
 *   await createHuman(page, { plugins: [logger] });
 *
 * Run this demo:  pnpm --filter @humanjs/examples plugin
 */

import { chromium, createHuman, type HumanPlugin } from '@humanjs/playwright';

/** A minimal observability plugin — logs every action and its duration. */
const logger: HumanPlugin = {
  name: 'logger',
  install: (ctx) => console.log(`[logger] installed · personality=${ctx.personality.name}`),
  beforeAction: (action) => console.log(`▶ ${action.type}`, action.params ?? {}),
  afterAction: (action, result) => console.log(`✓ ${action.type} — ${result.durationMs}ms`),
  onError: (action, error) => console.error(`✕ ${action.type}`, error),
};

const PAGE =
  '<!doctype html><meta charset="utf-8">' +
  '<body style="margin:40px;font-family:sans-serif">' +
  '<button id="start">Start</button>' +
  '<input id="email" placeholder="email" style="display:block;margin-top:16px">' +
  '</body>';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(PAGE);

  const human = await createHuman(page, { plugins: [logger], speed: 'instant' });
  await human.click('#start');
  await human.type('#email', 'hi@example.com');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
