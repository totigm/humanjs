/**
 * HumanJS generator demo — record a clean flow, then print the test the
 * generator would produce.
 *
 * The visual generator (`npx @humanjs/generator <url>`) captures your clicks in
 * a real browser and exports a humanized `@playwright/test` spec. This demo
 * shows the engine behind that export, headless and offline: it records a short
 * session, then runs the public codegen (`generatePlaywrightTest` /
 * `generateHumanJS`) on the timeline and prints both a spec and a standalone
 * script.
 *
 * Run with:
 *   pnpm demo:generate
 *   PERSONALITY=distracted pnpm demo:generate   (changes the generated humanOptions)
 */

import {
  chromium,
  createHuman,
  generateHumanJS,
  generatePlaywrightTest,
} from '@humanjs/playwright';
import { parsePersonality } from './lib';

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sign in</title>
  </head>
  <body>
    <h1>Sign in</h1>
    <label>Email <input id="email" type="email" autocomplete="off" spellcheck="false" /></label>
    <label>Password <input id="password" type="password" autocomplete="off" /></label>
    <button type="button" id="continue">Continue</button>
  </body>
</html>
`;

function banner(title: string): void {
  const rule = '─'.repeat(64);
  console.log(`\n${rule}\n  ${title}\n${rule}`);
}

async function main() {
  const personality = parsePersonality(process.env.PERSONALITY, 'careful', 'PERSONALITY');

  // Headless — this demo is about the generated code, not a visible run.
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(DEMO_HTML);
    const human = await createHuman(page, { personality, seed: 'generate-demo' });

    // Timeline-only recording (`video: false`) — no frame capture or ffmpeg.
    // We only want the action log to feed the codegen, exactly like the
    // generator's export does. Selectors are role-first, with a CSS fallback
    // for the password field (password inputs expose no `textbox` role).
    const rec = await human.record({ name: 'sign in', video: false }, async () => {
      await human.type('role=textbox[name="Email"]', 'demo@humanjs.dev');
      await human.type('#password', 'hunter2'); // password input → value is masked
      await human.click('role=button[name="Continue"]');
    });

    // The same public codegen the generator runs on a curated timeline. The
    // spec uses the `@humanjs/playwright/test` fixture (instant in CI); the
    // standalone script drives a `createHuman` session directly.
    banner('generatePlaywrightTest(timeline) → sign-in.spec.ts');
    console.log(generatePlaywrightTest(rec.timeline));

    banner('generateHumanJS(timeline) → sign-in.ts');
    console.log(generateHumanJS(rec.timeline));

    console.log(
      `\nCaptured ${rec.timeline.events.length} actions — this is what "npx @humanjs/generator <url>" exports, minus the visual editor.`,
    );
    console.log('The password value is masked; edit the export to read it from process.env.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
