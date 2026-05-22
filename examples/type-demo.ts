/**
 * HumanJS type demo — opens a real Chrome window and types a sentence into
 * a focused input so you can watch the per-key rhythm, typos, and backspace
 * recoveries unfold at the personality's natural pace.
 *
 * Run with:
 *   pnpm demo:type
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful     pnpm demo:type   (default)
 *   PERSONALITY=fast        pnpm demo:type
 *   PERSONALITY=precise     pnpm demo:type
 *   PERSONALITY=distracted  pnpm demo:type
 */

import { createHuman, installMouseHelper } from '@humanjs/playwright';
import { chromium } from 'playwright';
import { parsePersonality, sleep } from './lib';

// Brand-direct phrase that matches the rest of the HumanJS surface area:
// three short sentences that describe what `human.type()` actually does.
const PHRASE = 'Real keystrokes. Real rhythm. Real backspace recovery.';

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HumanJS type demo</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 30% 20%, #1a1a2e, #0a0a0a);
        color: #fff;
        font-family: -apple-system, system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 32px;
      }
      .header {
        text-align: center;
        margin-bottom: 48px;
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
      .phrase {
        font-family: ui-monospace, SF Mono, monospace;
        color: #666;
        font-size: 13px;
        margin-bottom: 18px;
        letter-spacing: 0.02em;
      }
      .phrase span { color: #f5a55c; }
      .input-wrap {
        position: relative;
        width: min(720px, 100%);
      }
      input {
        width: 100%;
        padding: 22px 26px;
        font-size: 22px;
        font-family: ui-monospace, SF Mono, monospace;
        color: #f5a55c;
        background: #0c0b0a;
        border: 1px solid #2a2a2a;
        border-radius: 14px;
        outline: none;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      input:focus {
        border-color: rgba(245, 165, 92, 0.4);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4), 0 0 0 4px rgba(245, 165, 92, 0.08);
      }
      .meta {
        margin-top: 24px;
        display: flex;
        gap: 28px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 12px;
        color: #777;
        text-transform: uppercase;
        letter-spacing: 0.18em;
      }
      .meta b {
        display: block;
        color: #f0ece5;
        font-size: 18px;
        margin-top: 4px;
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>HumanJS type demo</h1>
      <p>Real per-key rhythm. Real typos. Real backspace recovery.</p>
    </div>

    <div class="phrase">
      target — <span id="target-phrase"></span>
    </div>

    <div class="input-wrap">
      <input id="field" autocomplete="off" spellcheck="false" placeholder="typing…" />
    </div>

    <div class="meta">
      <div>Personality<b id="personality">—</b></div>
      <div>Characters<b id="chars">0</b></div>
      <div>Elapsed<b id="elapsed">0.0s</b></div>
    </div>

    <script>
      document.getElementById('target-phrase').textContent = ${JSON.stringify(PHRASE)};
      const field = document.getElementById('field');
      const chars = document.getElementById('chars');
      const elapsed = document.getElementById('elapsed');
      let startedAt = null;
      field.addEventListener('input', () => {
        if (startedAt === null) startedAt = performance.now();
        chars.textContent = field.value.length;
      });
      function tickElapsed() {
        if (startedAt !== null) {
          const sec = ((performance.now() - startedAt) / 1000).toFixed(1);
          elapsed.textContent = sec + 's';
        }
        requestAnimationFrame(tickElapsed);
      }
      requestAnimationFrame(tickElapsed);
    </script>
  </body>
</html>
`;

async function main() {
  const personality = parsePersonality(process.env.PERSONALITY, 'careful', 'PERSONALITY');

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1100,720'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 720 },
    });
    const page = await context.newPage();

    await page.setContent(DEMO_HTML);
    // Inject the HumanJS cursor overlay so synthetic mouse motion is visible
    // in headed Chrome — `page.mouse.move()` doesn't render a system pointer.
    // Installed AFTER setContent because setContent replaces the document.
    await installMouseHelper(page);
    await page.evaluate((name) => {
      const el = document.getElementById('personality');
      if (el) el.textContent = name;
    }, personality);

    console.log(`Personality: ${personality}`);
    console.log(`Typing: "${PHRASE}"\n`);

    const human = await createHuman(page, {
      personality,
      seed: 'type-demo-1',
      plugins: [
        {
          name: 'logger',
          beforeAction: (action) =>
            console.log(`→ ${action.type} ${JSON.stringify(action.params)}`),
          afterAction: (action, result) => {
            const length = (action.params?.length as number) ?? 0;
            const perChar = length > 0 ? (result.durationMs / length).toFixed(1) : '—';
            console.log(`✓ ${action.type} took ${result.durationMs}ms (${perChar}ms/char)`);
          },
        },
      ],
    });

    // Give the page a beat to render before we focus + type.
    await sleep(600);

    await human.type('#field', PHRASE);

    // Read the final value so we can show whether any typos were left
    // uncorrected — that's a real personality signal, not a bug.
    const finalValue = await page.locator('#field').inputValue();
    console.log(`\nFinal value: "${finalValue}"`);
    if (finalValue !== PHRASE) {
      console.log('⚠  Final string differs from target — uncorrected typos are expected at');
      console.log(
        '   `typoCorrectionProbability < 1`. Try PERSONALITY=precise for cleaner output.',
      );
    }

    console.log('\nDone. Browser will stay open for 5 seconds.');
    console.log('Tip: re-run with PERSONALITY=fast (or precise / distracted) to compare.');
    await sleep(5000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
