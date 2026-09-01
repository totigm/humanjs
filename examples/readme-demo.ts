/**
 * HumanJS README demo — renders the animated asset at the top of the
 * root README.
 *
 * The README is the first thing anyone sees, and HumanJS is a library
 * about motion, so a still image undersells it. This script exists so the
 * asset is reproducible rather than a one-off someone recorded by hand and
 * nobody can regenerate.
 *
 * Run from the repo root with:
 *   pnpm demo:readme
 *
 * It writes straight to .github/demo.gif — the path the README points at —
 * so regenerating the asset is one command with nothing to copy by hand.
 *
 * Deliberately short and deliberately narrow in what it shows: a curved
 * approach to a button, typing with real rhythm, and a reading dwell.
 * Those three are the whole pitch, and a GIF that loops in ten seconds
 * gets watched where a thirty-second one does not.
 */

import { record } from '@humanjs/recorder';

// Brand tokens mirrored from apps/web/app/globals.css so the asset does
// not drift from the landing page it sits next to.
const INK = '#020203';
const SURFACE = '#0c0b0a';
const FOREGROUND = '#f0ece5';
const MUTED = '#8a857c';
const ACCENT = '#f5a55c';

// NOTE: no backticks anywhere inside this template literal — a stray one
// closes it and esbuild fails at runtime, which biome does not catch.
const DEMO_HTML = /* html */ `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>HumanJS</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background:
          radial-gradient(circle at 22% 18%, rgba(245, 165, 92, 0.10), transparent 55%),
          ${INK};
        color: ${FOREGROUND};
        font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      }
      .card {
        width: 620px;
        padding: 46px 48px;
        border-radius: 18px;
        background: ${SURFACE};
        border: 1px solid rgba(245, 230, 215, 0.08);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
      }
      .eyebrow {
        font-family: ui-monospace, "SF Mono", monospace;
        font-size: 11px;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: ${MUTED};
        margin: 0 0 18px;
      }
      .eyebrow span { color: ${ACCENT}; }
      h1 {
        margin: 0 0 10px;
        font-size: 32px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .passage {
        margin: 0 0 26px;
        font-size: 15px;
        line-height: 1.65;
        color: ${MUTED};
      }
      label {
        display: block;
        font-size: 12px;
        color: ${MUTED};
        margin: 0 0 8px;
      }
      input {
        width: 100%;
        padding: 13px 15px;
        font-size: 15px;
        color: ${FOREGROUND};
        background: rgba(245, 230, 215, 0.04);
        border: 1px solid rgba(245, 230, 215, 0.12);
        border-radius: 10px;
        outline: none;
        transition: border-color 160ms ease;
      }
      input:focus { border-color: ${ACCENT}; }
      button {
        width: 100%;
        margin-top: 18px;
        padding: 13px;
        font-size: 15px;
        font-weight: 600;
        color: ${INK};
        background: ${ACCENT};
        border: 0;
        border-radius: 10px;
        cursor: pointer;
        transition: filter 160ms ease;
      }
      button:hover { filter: brightness(1.08); }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="eyebrow">Human<span>JS</span></p>
      <h1>Automation that moves like a person</h1>
      <p class="passage">
        Curved cursor paths, typing with real rhythm, and pauses where a
        reader would actually pause.
      </p>
      <label for="email">Work email</label>
      <input id="email" type="email" placeholder="you@company.com" autocomplete="off" />
      <button id="cta" type="button">Start recording</button>
    </div>
  </body>
</html>
`;

async function main(): Promise<void> {
  const rec = await record(
    {
      output: '../.github/demo.gif',
      name: 'HumanJS README demo',
      personality: 'careful',
      // Pinned so re-running produces the same asset — a README image that
      // changes shape on every regeneration is noise in every diff.
      seed: 'humanjs-readme-v1',
      viewport: { width: 1000, height: 540 },
      headless: false,
      quality: 'high',
    },
    async (human, page) => {
      await page.setContent(DEMO_HTML);
      await human.sleep(700);

      await human.read('.passage');
      await human.sleep(250);

      await human.type('#email', 'you@company.com');
      await human.sleep(450);

      await human.click('#cta');
      await human.sleep(900);
    },
  );

  console.log(`Captured ${rec.timeline.events.length} actions in ${rec.durationMs}ms.`);
  console.log('Wrote .github/demo.gif — the README picks it up from there.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
