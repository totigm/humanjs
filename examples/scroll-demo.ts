/**
 * HumanJS scroll demo — opens a tall page and scrolls through it the way a
 * real reader would: a natural one-viewport step, a targeted jump to a
 * section, all the way to the bottom, then back to the top.
 *
 * Run with:
 *   pnpm demo:scroll
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful     pnpm demo:scroll   (default)
 *   PERSONALITY=fast        pnpm demo:scroll
 *   PERSONALITY=precise     pnpm demo:scroll
 *   PERSONALITY=distracted  pnpm demo:scroll
 */

import { chromium, createHuman, installMouseHelper } from '@humanjs/playwright';
import { parsePersonality, sleep } from './lib';

const SECTIONS = [
  { id: 'hero', title: 'Hero', accent: '#f5a55c' },
  { id: 'features', title: 'Features', accent: '#5b7cc9' },
  { id: 'pricing', title: 'Pricing', accent: '#7abf85' },
  { id: 'testimonials', title: 'Testimonials', accent: '#d77fa3' },
  { id: 'faq', title: 'FAQ', accent: '#c9a35b' },
  { id: 'footer', title: 'Footer', accent: '#888' },
];

const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HumanJS scroll demo</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      html, body {
        /* Wider than the viewport so we can test horizontal *window*
           scroll directly — no container in the path. */
        width: 200vw;
        min-width: 200vw;
      }
      body {
        margin: 0;
        background: #0a0a0a;
        color: #f0ece5;
        font-family: -apple-system, system-ui, sans-serif;
      }
      .marker {
        position: fixed;
        top: 16px;
        right: 24px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #888;
        background: rgba(20, 20, 20, 0.9);
        border: 1px solid #2a2a2a;
        padding: 8px 14px;
        border-radius: 999px;
        z-index: 10;
      }
      .marker span { color: #f5a55c; }
      section {
        min-height: 100vh;
        padding: 56px 48px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-bottom: 1px solid #1a1a1a;
        position: relative;
      }
      section h2 {
        margin: 0 0 12px;
        font-size: 64px;
        font-weight: 700;
        letter-spacing: -0.03em;
      }
      section .label {
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #555;
        margin-bottom: 24px;
      }
      section p {
        max-width: 640px;
        text-align: center;
        font-size: 18px;
        line-height: 1.6;
        color: #aaa;
      }
      section .pill {
        margin-top: 24px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 12px;
        color: #555;
        border: 1px solid #2a2a2a;
        padding: 6px 14px;
        border-radius: 999px;
      }
    </style>
  </head>
  <body>
    <div class="marker">human.<span>scroll()</span></div>
    ${SECTIONS.map(
      (s) => /* html */ `
      <section id="${s.id}" style="background: radial-gradient(circle at 50% 30%, ${s.accent}22, transparent 60%);">
        <div class="label">section</div>
        <h2 style="color: ${s.accent};">${s.title}</h2>
        <p>A real reader scrolls through pages in bursts — not one giant jump.
        Wheel events come in waves with mid-scroll micro-pauses; sometimes
        the scroll overshoots and corrects back. HumanJS models that.</p>
        <div class="pill">#${s.id}</div>
      </section>`,
    ).join('')}

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
      seed: 'scroll-demo-1',
      plugins: [
        {
          name: 'logger',
          afterAction: (action, result) => {
            if (action.type !== 'scroll') return;
            const target = action.params?.target;
            console.log(`✓ scroll → ${target} (${result.durationMs}ms)`);
          },
        },
      ],
    });

    await sleep(600);

    // 1. Horizontal scroll to the center of the 200vw-wide body. After
    // this lands, sections (which are also 200vw wide with content
    // centered horizontally) sit cleanly centered in the viewport.
    const halfwayX = await page.evaluate(() =>
      Math.floor((document.documentElement.scrollWidth - window.innerWidth) / 2),
    );
    await human.scroll({ to: halfwayX }, { axis: 'x' });
    await sleep(800);

    // 2. Natural one-viewport scroll — what a real reader does first.
    await human.scroll();
    await sleep(800);

    // 3. Jump to a specific section by selector.
    await human.scroll('#pricing', { overshoot: true });
    await sleep(800);

    // 4. Scroll to bottom — long-distance scroll exercises the bell-curve
    // velocity profile and mid-scroll pauses.
    await human.scroll('end');
    await sleep(800);

    // 5. Back to the top.
    await human.scroll('top');
    await sleep(800);

    // 6. Forced overshoot — for personalities that wouldn't normally do
    // one, opt in via the options object to see the correction behavior.
    await human.scroll('#testimonials', { overshoot: true });

    console.log('\nDone. Browser will stay open for 5 seconds.');
    console.log('Tip: re-run with PERSONALITY=distracted to see lots of overshoot.');
    await sleep(5000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
