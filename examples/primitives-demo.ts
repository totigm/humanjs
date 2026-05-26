/**
 * HumanJS primitives demo — exercises the five "second-tier" Human methods
 * in sequence on one page so a viewer can see them all work visually:
 *
 *   1. hover       — cursor moves to a target, tooltip appears via :hover
 *   2. rightClick  — context-menu click, custom menu appears
 *   3. drag        — selector → selector card move, then selector → point slider
 *   4. paste       — long string lands in a textarea via insertText (no rhythm)
 *   5. shortcut    — Mod+S triggers a Save indicator
 *
 * Run with:
 *   pnpm demo:primitives
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful     pnpm demo:primitives   (default)
 *   PERSONALITY=fast        pnpm demo:primitives
 *   PERSONALITY=precise     pnpm demo:primitives
 *   PERSONALITY=distracted  pnpm demo:primitives
 */

import { chromium, createHuman, installMouseHelper } from '@humanjs/playwright';
import { parsePersonality } from './lib';

// Embedded HTML: every section is interactive in some visible way so the
// primitive's effect is observable when the headed browser runs through it.
// NOTE per CLAUDE.md: no nested backticks anywhere in this template literal.
const DEMO_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HumanJS primitives demo</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 30% 20%, #1a1a2e, #0a0a0a);
        color: #f0ece5;
        font-family: -apple-system, system-ui, sans-serif;
        padding: 48px 32px;
      }
      .wrap { max-width: 920px; margin: 0 auto; display: grid; gap: 28px; }
      .header { text-align: center; margin-bottom: 16px; }
      .header h1 {
        margin: 0 0 6px;
        font-size: 32px;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .header p { margin: 0; color: #888; font-size: 14px; }

      .block {
        padding: 24px 28px;
        background: #0c0b0a;
        border: 1px solid #2a2a2a;
        border-radius: 14px;
      }
      .block .label {
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: #555;
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .label .num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #f5a55c;
        color: #050505;
        font-weight: 700;
        font-family: -apple-system, system-ui, sans-serif;
        font-size: 11px;
        letter-spacing: 0;
      }

      /* 1. Hover */
      .tooltip-host {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        color: #f0ece5;
        font-size: 22px;
        font-weight: 600;
        cursor: help;
      }
      .tooltip-host .tip {
        position: absolute;
        bottom: calc(100% + 12px);
        left: 50%;
        transform: translateX(-50%) translateY(8px);
        opacity: 0;
        white-space: nowrap;
        background: #050505;
        color: #f5a55c;
        border: 1px solid #f5a55c33;
        padding: 8px 14px;
        border-radius: 8px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 13px;
        pointer-events: none;
        transition: all 0.18s ease;
      }
      .tooltip-host:hover .tip {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      /* 2. Right-click */
      .ctx-host {
        position: relative;
        display: inline-block;
        padding: 12px 22px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 14px;
        color: #f0ece5;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 10px;
        cursor: context-menu;
      }
      .ctx-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 6px;
        min-width: 180px;
        background: #050505;
        border: 1px solid #2a2a2a;
        border-radius: 10px;
        padding: 6px;
        opacity: 0;
        transform: translateY(-4px);
        pointer-events: none;
        transition: all 0.16s ease;
        z-index: 10;
      }
      .ctx-menu.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .ctx-menu .item {
        padding: 8px 12px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 12px;
        color: #b8b3a9;
        border-radius: 6px;
      }
      .ctx-menu .item:hover { background: #1a1a1a; color: #f5a55c; }

      /* 3. Drag */
      .drag-row {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 8px;
      }
      .drag-slot {
        flex: 1;
        min-height: 84px;
        border: 1px dashed #2a2a2a;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 11px;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .drag-slot.has-card { border-color: #f5a55c66; background: #f5a55c11; color: #f5a55c; }
      .drag-card {
        padding: 18px 26px;
        background: linear-gradient(180deg, #334155, #1e293b);
        border: 1px solid #475569;
        border-radius: 10px;
        color: #fff;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 13px;
        cursor: grab;
        user-select: none;
      }
      .drag-card.dragging { opacity: 0.6; cursor: grabbing; }

      .slider-row {
        position: relative;
        margin-top: 18px;
        height: 36px;
      }
      .slider-track {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 4px;
        transform: translateY(-50%);
        background: #2a2a2a;
        border-radius: 2px;
      }
      .slider-fill {
        position: absolute;
        top: 50%;
        left: 0;
        height: 4px;
        transform: translateY(-50%);
        background: #f5a55c;
        border-radius: 2px;
        width: 8%;
        transition: width 0.08s linear;
      }
      .slider-thumb {
        position: absolute;
        top: 50%;
        width: 22px;
        height: 22px;
        transform: translate(-50%, -50%);
        background: #f5a55c;
        border: 2px solid #050505;
        border-radius: 50%;
        left: 8%;
        cursor: grab;
        transition: left 0.08s linear;
      }

      /* 4. Paste */
      .paste-box {
        width: 100%;
        min-height: 100px;
        padding: 14px 16px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 13px;
        color: #f5a55c;
        background: #050505;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        outline: none;
        resize: none;
        line-height: 1.55;
      }
      .paste-box:focus { border-color: rgba(245, 165, 92, 0.4); }

      /* 5. Shortcut */
      .save-host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .save-host .doc {
        flex: 1;
        padding: 14px 16px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 13px;
        color: #b8b3a9;
        background: #050505;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
      }
      .save-indicator {
        padding: 10px 18px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #555;
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        transition: all 0.3s ease;
      }
      .save-indicator.saved {
        color: #050505;
        background: #f5a55c;
        border-color: #f5a55c;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <h1>HumanJS primitives</h1>
        <p>Five things a real user does that scripted automation usually fakes.</p>
      </div>

      <!-- 1. Hover -->
      <div class="block">
        <div class="label"><span class="num">1</span> hover</div>
        <div class="tooltip-host" id="tooltip-target">
          ?
          <div class="tip">Hover-only UI works because the cursor really moves here.</div>
        </div>
      </div>

      <!-- 2. Right-click -->
      <div class="block">
        <div class="label"><span class="num">2</span> rightClick</div>
        <div class="ctx-host" id="ctx-target">
          card-001.pdf
          <div class="ctx-menu" id="ctx-menu">
            <div class="item">Open</div>
            <div class="item">Open in new tab</div>
            <div class="item">Rename</div>
            <div class="item">Delete</div>
          </div>
        </div>
      </div>

      <!-- 3. Drag -->
      <div class="block">
        <div class="label"><span class="num">3</span> drag</div>
        <div class="drag-row">
          <div class="drag-slot has-card" id="slot-from">
            <div class="drag-card" id="drag-card">card-A</div>
          </div>
          <div style="color: #444">→</div>
          <div class="drag-slot" id="slot-to">drop here</div>
        </div>
        <div class="slider-row">
          <div class="slider-track"></div>
          <div class="slider-fill" id="slider-fill"></div>
          <div class="slider-thumb" id="slider-thumb"></div>
        </div>
      </div>

      <!-- 4. Paste -->
      <div class="block">
        <div class="label"><span class="num">4</span> paste</div>
        <textarea class="paste-box" id="paste-target" placeholder="long content goes here…" spellcheck="false"></textarea>
      </div>

      <!-- 5. Shortcut -->
      <div class="block">
        <div class="label"><span class="num">5</span> shortcut</div>
        <div class="save-host">
          <div class="doc">document — type to edit</div>
          <div class="save-indicator" id="save-indicator">unsaved</div>
        </div>
      </div>
    </div>

    <script>
      // --- 1. hover --- (handled purely by CSS :hover on .tooltip-host)

      // --- 2. rightClick --- custom context menu, suppresses the OS one
      const ctxMenu = document.getElementById('ctx-menu');
      const ctxHost = document.getElementById('ctx-target');
      ctxHost.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ctxMenu.classList.add('visible');
        setTimeout(() => ctxMenu.classList.remove('visible'), 2200);
      });

      // --- 3. drag --- mousedown/move/up on the card, visual feedback on drop
      const card = document.getElementById('drag-card');
      const slotFrom = document.getElementById('slot-from');
      const slotTo = document.getElementById('slot-to');
      let dragging = false;
      let dragOriginX = 0;
      let dragOriginY = 0;
      let dragStartX = 0;
      let dragStartY = 0;
      card.addEventListener('mousedown', (e) => {
        dragging = true;
        const r = card.getBoundingClientRect();
        dragOriginX = r.left;
        dragOriginY = r.top;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        card.classList.add('dragging');
        card.style.position = 'fixed';
        card.style.left = dragOriginX + 'px';
        card.style.top = dragOriginY + 'px';
        card.style.zIndex = '100';
      });
      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        card.style.left = (dragOriginX + (e.clientX - dragStartX)) + 'px';
        card.style.top = (dragOriginY + (e.clientY - dragStartY)) + 'px';
      });
      window.addEventListener('mouseup', (e) => {
        if (!dragging) return;
        dragging = false;
        card.classList.remove('dragging');
        const toRect = slotTo.getBoundingClientRect();
        const landed =
          e.clientX >= toRect.left && e.clientX <= toRect.right &&
          e.clientY >= toRect.top && e.clientY <= toRect.bottom;
        if (landed) {
          slotFrom.classList.remove('has-card');
          slotFrom.textContent = 'empty';
          slotTo.classList.add('has-card');
          slotTo.appendChild(card);
          card.style.position = 'static';
          card.style.left = card.style.top = card.style.zIndex = '';
        } else {
          // Snap back
          card.style.position = 'static';
          card.style.left = card.style.top = card.style.zIndex = '';
        }
      });

      // Slider — separate drag target so we can demo the Point variant
      const thumb = document.getElementById('slider-thumb');
      const fill = document.getElementById('slider-fill');
      let sliderDragging = false;
      thumb.addEventListener('mousedown', () => { sliderDragging = true; });
      window.addEventListener('mousemove', (e) => {
        if (!sliderDragging) return;
        const trackRect = thumb.parentElement.getBoundingClientRect();
        const rel = (e.clientX - trackRect.left) / trackRect.width;
        const clamped = Math.max(0, Math.min(1, rel));
        thumb.style.left = (clamped * 100) + '%';
        fill.style.width = (clamped * 100) + '%';
      });
      window.addEventListener('mouseup', () => { sliderDragging = false; });

      // --- 5. shortcut --- Mod+S handler flashes the save indicator
      const saveIndicator = document.getElementById('save-indicator');
      window.addEventListener('keydown', (e) => {
        const isSaveCombo = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S');
        if (isSaveCombo) {
          e.preventDefault();
          saveIndicator.classList.add('saved');
          saveIndicator.textContent = 'saved ✓';
          setTimeout(() => {
            saveIndicator.classList.remove('saved');
            saveIndicator.textContent = 'unsaved';
          }, 1800);
        }
      });
    </script>
  </body>
</html>
`;

const LONG_PASTE_VALUE = [
  '// const config = await loadConfig();',
  "// if (!config) throw new Error('config missing');",
  '// connectToService(config.url, config.token);',
  '// — every paste a human does happens in one shot, never per-character.',
].join('\n');

async function main() {
  const personality = parsePersonality(process.env.PERSONALITY, 'careful', 'PERSONALITY');

  console.log(`Personality: ${personality}`);
  console.log('Demoing: hover → rightClick → drag → paste → shortcut\n');

  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.setContent(DEMO_HTML);
    await installMouseHelper(context);

    const human = await createHuman(page, { personality, seed: 'primitives-demo-1' });
    await human.sleep(800);

    // 1. Hover — cursor moves to the "?" icon, tooltip reveals via CSS.
    console.log('1. hover → tooltip target');
    await human.hover('#tooltip-target');
    await human.sleep(1200);

    // 2. Right-click — custom context menu opens on contextmenu event.
    console.log('2. rightClick → context menu');
    await human.rightClick('#ctx-target');
    await human.sleep(1500);

    // 3. Drag — card from one slot to another. Selector → selector first,
    // then a slider drag using a Point coordinate to demo the Point variant.
    console.log('3. drag → card to slot, then slider thumb to point');
    await human.drag('#drag-card', '#slot-to');
    await human.sleep(900);
    await human.drag('#slider-thumb', { x: 800, y: 685 });
    await human.sleep(900);

    // 4. Paste — long string lands in the textarea instantly via insertText.
    console.log('4. paste → multi-line block into textarea');
    await human.paste('#paste-target', LONG_PASTE_VALUE);
    await human.sleep(900);

    // 5. Shortcut — Mod+S triggers the page's save handler, indicator flashes.
    // The textarea is still focused from the paste above, so the keystroke
    // dispatches on a real element with focus.
    console.log('5. shortcut → Mod+S triggers Save');
    await human.shortcut('Mod+S');
    await human.sleep(2500);

    console.log('\nDone. Browser will stay open for 5 seconds.');
    console.log('Tip: re-run with PERSONALITY=distracted to see the drag scatter more.');
    await human.sleep(5000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
