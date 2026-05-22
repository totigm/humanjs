/**
 * HumanJS read demo — opens a real Chrome window and dwells on three
 * passages so you can watch how `human.read()` paces itself differently
 * for prose, code (auto-detected from `<pre>`), and skim mode (`kind: 'scan'`).
 *
 * Run with:
 *   pnpm demo:read
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful     pnpm demo:read   (default)
 *   PERSONALITY=fast        pnpm demo:read
 *   PERSONALITY=precise     pnpm demo:read
 *   PERSONALITY=distracted  pnpm demo:read
 */

import { createHuman, installMouseHelper } from '@humanjs/playwright';
import { chromium } from 'playwright';
import { parsePersonality, sleep } from './lib';

const PASSAGE =
  "The cursor doesn't have to lie. It can take a real path, type at a real rhythm, and dwell where a person would dwell. That's the whole library.";

const CODE_SNIPPET = `import { createHuman } from '@humanjs/playwright';

const human = await createHuman(page, {
  personality: 'careful',
  seed: 'session-42',
});

await human.read('.welcome-message');`;

const LIST_ITEMS = [
  'Faster than instant clicks',
  'Bezier paths with micro-jitter',
  'Per-key typing rhythm + typos',
  'Reading dwell scaled by personality',
  'Plugin-observable everywhere',
];

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HumanJS read demo</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 30% 20%, #1a1a2e, #0a0a0a);
        color: #f0ece5;
        font-family: -apple-system, system-ui, sans-serif;
        padding: 56px 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 28px;
      }
      .header {
        text-align: center;
        margin-bottom: 8px;
      }
      .header h1 {
        margin: 0 0 6px;
        font-size: 28px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .header p {
        margin: 0;
        color: #888;
        font-size: 14px;
      }
      .block {
        position: relative;
        width: min(720px, 100%);
        padding: 28px 32px;
        background: #0c0b0a;
        border: 1px solid #2a2a2a;
        border-radius: 14px;
        transition: border-color 0.4s ease, box-shadow 0.4s ease, color 0.4s ease;
      }
      .label {
        position: absolute;
        top: 12px;
        right: 16px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #555;
      }
      .passage {
        font-size: 18px;
        line-height: 1.6;
      }
      pre.code-snippet {
        margin: 0;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 14px;
        line-height: 1.7;
        color: #d9d6cf;
        white-space: pre-wrap;
      }
      .scan-list {
        margin: 0;
        padding-left: 22px;
        line-height: 1.8;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>HumanJS read demo</h1>
      <p>Reading dwell scaled by content kind — prose, code, scan.</p>
    </div>

    <div class="block" id="passage">
      <span class="label">prose</span>
      <p class="passage">${PASSAGE}</p>
    </div>

    <div class="block" id="code">
      <span class="label">code (auto-detected)</span>
      <pre class="code-snippet">${escapeHtml(CODE_SNIPPET)}</pre>
    </div>

    <div class="block" id="list">
      <span class="label">scan</span>
      <ul class="scan-list">
        ${LIST_ITEMS.map((item) => `<li>${item}</li>`).join('\n        ')}
      </ul>
    </div>
  </body>
</html>
`;

async function main() {
  const personality = parsePersonality(process.env.PERSONALITY, 'careful', 'PERSONALITY');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1100,820'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 820 } });
    const page = await context.newPage();
    await page.setContent(DEMO_HTML);
    // Inject the HumanJS cursor overlay so synthetic mouse motion is visible
    // in headed Chrome — `page.mouse.move()` doesn't render a system pointer.
    // Installed AFTER setContent because setContent replaces the document.
    await installMouseHelper(page);

    console.log(`Personality: ${personality}\n`);

    const human = await createHuman(page, {
      personality,
      seed: 'read-demo-1',
      plugins: [
        {
          name: 'logger',
          afterAction: (action, result) => {
            if (action.type !== 'read') return;
            const params = action.params ?? {};
            console.log(
              `✓ read ${JSON.stringify({ target: params.target, kind: params.kind })} took ${result.durationMs}ms`,
            );
          },
        },
      ],
    });

    await sleep(500);

    // `withMotion: true` walks a humanized cursor scan through each element's
    // bounding box as the dwell elapses — the third pillar (the pace) made
    // visible alongside the cursor itself, so the headed browser shows where
    // attention is and how it moves.

    // Target the content elements directly, not the outer `.block` wrappers
    // — the wrappers also contain an absolutely-positioned `<span class="label">`
    // ("prose", "code (auto-detected)", "scan"), and `withMotion`'s
    // per-line-rect scan would otherwise include those labels too.

    // 1. Prose — defaults to kind 'prose'
    await human.read('.passage', { withMotion: true });
    await sleep(600);

    // 2. Code — auto-detected from <pre> tag, no explicit kind
    await human.read('.code-snippet', { withMotion: true });
    await sleep(600);

    // 3. Scan — explicit kind to skim a list
    await human.read('.scan-list', { kind: 'scan', withMotion: true });

    console.log('\nDone. Browser will stay open for 5 seconds.');
    console.log('Tip: re-run with PERSONALITY=fast (or precise / distracted) to compare.');
    await sleep(5000);
  } finally {
    await browser.close();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
