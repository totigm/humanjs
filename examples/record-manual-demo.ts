/**
 * HumanJS record demo — manual lifecycle.
 *
 * Same end result as `pnpm demo:record` (one mp4 of a humanized session)
 * but uses the lower-level @humanjs/playwright API directly so you can
 * see how the recording surface composes with normal Playwright code:
 *
 *   1. Standard `chromium.launch()` — no recording option needed
 *   2. Standard `browser.newContext()` + `context.newPage()`
 *   3. `human.record(cb)` starts frame capture, runs the callback,
 *      stops capture; returns a Recording
 *   4. `rec.toVideo(path)` assembles captured frames into mp4
 *
 * Use this shape when you already have a Playwright setup, need
 * multi-page flows, or want to record a slice of a longer session.
 *
 * Run with:
 *   pnpm demo:record-manual
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful     pnpm demo:record-manual   (default)
 *   PERSONALITY=fast        pnpm demo:record-manual
 *   PERSONALITY=distracted  pnpm demo:record-manual
 *
 * Output path: ./recordings/humanjs-manual-<personality>.mp4
 *   Override with: OUTPUT=path/to/file.mp4 pnpm demo:record-manual
 */

import { chromium, createHuman, installMouseHelper } from '@humanjs/playwright';
import { parsePersonality, sleep } from './lib';

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HumanJS record demo (manual)</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 30% 20%, #1a1a2e, #0a0a0a);
        color: #f0ece5;
        font-family: -apple-system, system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 64px 32px;
        gap: 28px;
      }
      h1 {
        margin: 0;
        font-size: 32px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .subtitle {
        margin: 0 0 16px;
        color: #888;
        font-size: 14px;
      }
      .panel {
        width: min(560px, 100%);
        padding: 28px 32px;
        background: #0c0b0a;
        border: 1px solid #2a2a2a;
        border-radius: 14px;
      }
      .label {
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #555;
        margin-bottom: 14px;
      }
      input {
        width: 100%;
        padding: 14px 16px;
        font-size: 16px;
        font-family: ui-monospace, SF Mono, monospace;
        color: #f5a55c;
        background: #050505;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        outline: none;
      }
      input:focus { border-color: rgba(245, 165, 92, 0.4); }
      button {
        margin-top: 16px;
        padding: 12px 24px;
        font-size: 15px;
        font-weight: 500;
        font-family: inherit;
        background: linear-gradient(180deg, #334155, #1e293b);
        color: #fff;
        border: 1px solid #475569;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      button.clicked {
        background: linear-gradient(180deg, #22c55e, #16a34a);
        border-color: #16a34a;
      }
    </style>
  </head>
  <body>
    <h1>HumanJS record demo</h1>
    <p class="subtitle">manual lifecycle — chromium.launch → human.record → toVideo</p>

    <div class="panel">
      <div class="label">type</div>
      <input id="email" placeholder="email" autocomplete="off" spellcheck="false" />
      <button id="submit">Submit</button>
    </div>

    <script>
      document.getElementById('submit').addEventListener('click', (e) => {
        e.currentTarget.classList.add('clicked');
        e.currentTarget.textContent = '✓ Submitted';
      });
    </script>
  </body>
</html>
`;

async function main() {
  const personality = parsePersonality(process.env.PERSONALITY, 'careful', 'PERSONALITY');
  const output = process.env.OUTPUT ?? `recordings/humanjs-manual-${personality}.mp4`;
  const timelineOutput = output.replace(/\.(mp4|webm)$/i, '.json');

  console.log(`Recording personality: ${personality}`);
  console.log(`Output: ${output}\n`);

  // 1. Vanilla `chromium.launch()` — no special launch options for recording.
  //    Frame capture starts inside `human.record()` below.
  const browser = await chromium.launch({ headless: false });
  try {
    // 2. Standard Playwright context / page creation.
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.setContent(DEMO_HTML);
    // 3. Install the visible cursor overlay. In Path Z the user controls
    //    when/where to install — useful if you want custom styling or
    //    intentionally no cursor on certain pages.
    await installMouseHelper(page);

    // 4. Create the humanized session as usual.
    const human = await createHuman(page, {
      personality,
      seed: 'record-manual-1',
    });

    await sleep(800);

    // 5. `human.record(cb)` starts polled-screenshot capture, runs the
    //    callback, stops capture, and returns a Recording with the frames
    //    + the structured action timeline. Nothing before this is recorded.
    const rec = await human.record(async () => {
      await human.type('#email', 'demo@humanjs.dev');
      await sleep(400);
      await human.click('#submit');
      await sleep(400);
    });

    // 6. Assemble the captured frames into an mp4 via ffmpeg. The browser
    //    context stays open — toVideo doesn't depend on the page lifecycle.
    await rec.toVideo(output);

    // 7. Timeline is in-memory; safe to write any time.
    await rec.toTimeline(timelineOutput);

    console.log(`Done (${rec.durationMs}ms recorded, ${rec.timeline.events.length} actions).`);
    console.log(`  Video:    ${output}`);
    console.log(`  Timeline: ${timelineOutput}`);
    console.log('Tip: re-run with PERSONALITY=distracted to see typos in the recording.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
