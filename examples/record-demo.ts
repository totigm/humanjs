/**
 * HumanJS record demo — records a humanized session to mp4.
 *
 * Run with:
 *   pnpm demo:record
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful     pnpm demo:record   (default)
 *   PERSONALITY=fast        pnpm demo:record
 *   PERSONALITY=precise     pnpm demo:record
 *   PERSONALITY=distracted  pnpm demo:record
 *
 * Output path: ./recordings/humanjs-<personality>.mp4
 *   Override with: OUTPUT=path/to/file.mp4 pnpm demo:record
 */

import { record } from '@humanjs/recorder';
import { parsePersonality } from './lib';

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HumanJS record demo</title>
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
        padding: 56px 32px 96px;
        gap: 28px;
      }
      .header { text-align: center; }
      .header h1 {
        margin: 0 0 6px;
        font-size: 32px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .header p { margin: 0; color: #888; font-size: 14px; }
      .block {
        width: min(720px, 100%);
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
        margin-top: 18px;
        padding: 14px 28px;
        font-size: 16px;
        font-weight: 500;
        font-family: inherit;
        background: linear-gradient(180deg, #334155, #1e293b);
        color: #fff;
        border: 1px solid #475569;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      button.clicked {
        background: linear-gradient(180deg, #22c55e, #16a34a);
        border-color: #16a34a;
      }
      .passage {
        font-size: 17px;
        line-height: 1.6;
        margin: 0;
      }
      .features {
        width: min(720px, 100%);
        display: grid;
        gap: 16px;
      }
      .features .feature {
        padding: 22px 26px;
        background: #0c0b0a;
        border: 1px solid #1c1c1c;
        border-radius: 12px;
        color: #b8b3a9;
        font-size: 15px;
        line-height: 1.55;
      }
      .features .feature b {
        display: block;
        color: #f5a55c;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        margin-bottom: 6px;
      }
      .spacer {
        height: 280px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>HumanJS record demo</h1>
      <p>Click, type, scroll, read — all humanized, all recorded to mp4.</p>
    </div>

    <div class="block" id="cta-block">
      <div class="label">click</div>
      <button id="start-btn">Start the demo</button>
    </div>

    <div class="block" id="form-block">
      <div class="label">type</div>
      <input id="email" placeholder="email" autocomplete="off" spellcheck="false" />
    </div>

    <!-- Filler so the next block sits below the fold. Without it the demo
         has nothing to scroll over and the scroll step is invisible. -->
    <div class="features">
      <div class="feature"><b>cursor</b>Bezier paths with sub-pixel jitter and a bell-curve velocity profile — no straight-line teleports.</div>
      <div class="feature"><b>keyboard</b>Per-key timing pulled from real touch-typist data, plus optional typos and backspace recovery.</div>
      <div class="feature"><b>scroll</b>Multi-segment wheel motion with mid-scroll pauses and the occasional overshoot.</div>
      <div class="feature"><b>reading</b>Dwell time scaled by word count and content type — code, prose, scan.</div>
    </div>
    <div class="spacer" aria-hidden="true"></div>

    <div class="block" id="passage-block">
      <div class="label">read</div>
      <p class="passage">A real cursor curves between targets. A real keyboard
      has rhythm. A real reader dwells. HumanJS turns automation into
      something the reader can't tell apart from a person.</p>
    </div>

    <script>
      document.getElementById('start-btn').addEventListener('click', (e) => {
        e.currentTarget.classList.add('clicked');
        e.currentTarget.textContent = '✓ Started';
      });
    </script>
  </body>
</html>
`;

async function main() {
  const personality = parsePersonality(process.env.PERSONALITY, 'careful', 'PERSONALITY');
  const output = process.env.OUTPUT ?? `recordings/humanjs-${personality}.mp4`;
  const timelineOutput = output.replace(/\.(mp4|webm)$/i, '.json');

  console.log(`Recording personality: ${personality}`);
  console.log(`Output: ${output}\n`);

  // `record()` returns a Recording — toVideo has already been called
  // internally because `output` was provided. We still have access to
  // toTimeline and the in-memory timeline for downstream uses.
  const rec = await record(
    {
      output,
      personality,
      seed: 'record-demo-1',
      viewport: { width: 1920, height: 1080 },
      headless: false,
      quality: 'high',
    },
    async (human, page) => {
      await page.setContent(DEMO_HTML);
      // The visible cursor overlay is auto-installed by record() — no need
      // to call installMouseHelper here. Opt out with `cursor: false` in
      // the options if you want a recording without it.
      await human.sleep(800);

      await human.click('#start-btn');
      await human.sleep(600);

      await human.type('#email', 'demo@humanjs.dev');
      await human.sleep(600);

      await human.scroll('#passage-block');
      await human.sleep(400);

      // human.read() traces a humanized cursor scan through the target by
      // default. Pass `{ withMotion: false }` to skip the motion if you
      // only care about the dwell timing (e.g. AI agent temporal realism).
      await human.read('.passage');
      await human.sleep(400);
    },
  );

  // Also dump the structured timeline alongside the video so the demo
  // showcases both outputs from a single recorded session.
  await rec.toTimeline(timelineOutput);

  console.log(`\nDone. Video saved to:    ${output}`);
  console.log(`      Timeline saved to: ${timelineOutput}`);
  console.log(`      Captured ${rec.timeline.events.length} actions in ${rec.durationMs}ms.`);
  console.log('Tip: re-run with PERSONALITY=distracted to see typos + overshoot in the recording.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
