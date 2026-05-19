/**
 * HumanJS click demo — opens a real Chrome window and clicks a sequence
 * of buttons so you can watch the cursor curve between targets.
 *
 * Run with:
 *   pnpm demo:click
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful  pnpm demo:click
 *   PERSONALITY=fast     pnpm demo:click
 *   PERSONALITY=precise  pnpm demo:click
 *   PERSONALITY=distracted pnpm demo:click   (default)
 */

import { createHuman } from '@humanjs/playwright';
import { chromium } from 'playwright';

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HumanJS click demo</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 30% 20%, #1a1a2e, #0a0a0a);
        color: #fff;
        font-family: -apple-system, system-ui, sans-serif;
        position: relative;
        overflow: hidden;
      }
      .header {
        position: absolute;
        top: 24px;
        left: 0;
        right: 0;
        text-align: center;
        z-index: 5;
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
      .target {
        position: absolute;
        padding: 18px 28px;
        font-size: 16px;
        font-weight: 500;
        font-family: inherit;
        background: linear-gradient(180deg, #334155, #1e293b);
        color: white;
        border: 1px solid #475569;
        border-radius: 12px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        transition: all 0.3s ease;
        min-width: 140px;
        text-align: center;
      }
      .target.clicked {
        background: linear-gradient(180deg, #22c55e, #16a34a);
        border-color: #16a34a;
        box-shadow: 0 8px 32px rgba(34, 197, 94, 0.45);
        transform: scale(1.05);
      }
      .target.clicked::before {
        content: "✓ ";
        font-weight: 700;
      }
      /* Five strategically placed targets so the path traces an interesting shape. */
      #btn-1 { top: 130px; left: 80px; }              /* top-left */
      #btn-2 { top: 130px; right: 80px; }             /* top-right */
      #btn-3 { top: 50%; left: 50%; transform: translate(-50%, -50%); }  /* center */
      #btn-3.clicked { transform: translate(-50%, -50%) scale(1.05); }
      #btn-4 { bottom: 160px; left: 80px; }           /* bottom-left */
      #btn-5 { bottom: 160px; right: 80px; }          /* bottom-right */

      #status {
        position: absolute;
        bottom: 24px;
        left: 0;
        right: 0;
        text-align: center;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 13px;
        color: #888;
      }
      #cursor {
        position: fixed;
        width: 14px;
        height: 14px;
        background: #ff4d4f;
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 9999;
        box-shadow: 0 0 12px rgba(255, 77, 79, 0.6);
      }
      .trail {
        position: fixed;
        width: 5px;
        height: 5px;
        background: rgba(255, 77, 79, 0.55);
        border-radius: 50%;
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 9998;
        animation: fade 1.6s linear forwards;
      }
      @keyframes fade {
        to { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>HumanJS click demo</h1>
      <p>Watch the red cursor — Bezier path, bell-curve velocity, sub-pixel jitter.</p>
    </div>

    <button class="target" id="btn-1">1. Top left</button>
    <button class="target" id="btn-2">2. Top right</button>
    <button class="target" id="btn-3">3. Center</button>
    <button class="target" id="btn-4">4. Bottom left</button>
    <button class="target" id="btn-5">5. Bottom right</button>

    <div id="status">Waiting for clicks…</div>

    <div id="cursor"></div>

    <script>
      const cursor = document.getElementById('cursor');
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        const trail = document.createElement('div');
        trail.className = 'trail';
        trail.style.left = e.clientX + 'px';
        trail.style.top = e.clientY + 'px';
        document.body.appendChild(trail);
        setTimeout(() => trail.remove(), 1600);
      });

      let clickedCount = 0;
      const total = document.querySelectorAll('.target').length;
      document.body.addEventListener('click', (e) => {
        const button = e.target.closest('.target');
        if (!button) return;
        if (button.classList.contains('clicked')) return;
        button.classList.add('clicked');
        clickedCount++;
        document.getElementById('status').textContent =
          'Clicked ' + clickedCount + ' / ' + total + ' — last: ' + button.textContent;
      });
    </script>
  </body>
</html>
`;

// Click order: top-left → bottom-right → top-right → bottom-left → center.
// Diagonal paths produce the most visually interesting curves.
const TARGET_SEQUENCE = ['#btn-1', '#btn-5', '#btn-2', '#btn-4', '#btn-3'];

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1100,800'],
  });
  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 },
  });
  const page = await context.newPage();

  await page.setContent(DEMO_HTML);

  // Give the user a moment to see the page before motion starts.
  console.log('Browser open. Sequence starts in a moment…\n');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const personality = (process.env.PERSONALITY ?? 'distracted') as
    | 'careful'
    | 'fast'
    | 'distracted'
    | 'precise';

  const human = await createHuman(page, {
    personality,
    seed: 'demo-1',
    plugins: [
      {
        name: 'logger',
        beforeAction: (action) => console.log(`→ ${action.type} ${JSON.stringify(action.params)}`),
        afterAction: (action, result) =>
          console.log(`✓ ${action.type} took ${result.durationMs}ms`),
      },
    ],
  });

  // Park the cursor far from the first target so the opening move is obvious.
  await page.mouse.move(50, 80);
  await new Promise((resolve) => setTimeout(resolve, 400));

  console.log(`Personality: ${personality}`);
  console.log(`Clicking ${TARGET_SEQUENCE.length} targets in sequence…\n`);

  for (const selector of TARGET_SEQUENCE) {
    await human.click(selector);
    // Cadence floor so the "clicked" visual stays perceptible across all
    // personalities — postActionMs adds on top for the slower ones. Matches
    // the same floor used by compare-demo.ts.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.log('\nDone. Browser will stay open for 5 seconds.');
  console.log('Tip: re-run with PERSONALITY=careful (or fast / precise) to compare.');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
