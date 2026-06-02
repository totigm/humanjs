/**
 * HumanJS primitives demo — walks through the core humanized primitives in
 * sequence on one page so a viewer can see them work visually (the form
 * primitives — doubleClick / check / selectOption / upload — aren't shown here):
 *
 *    1. hover       — cursor moves to a target, tooltip appears via :hover
 *    2. click       — basic Bezier-path click on a button
 *    3. rightClick  — context-menu click, custom menu appears
 *    4. drag        — selector → selector card move, then selector → Point slider
 *    5. type & clear — per-key typing into an input, then select-all + delete and retype
 *    6. press       — Mod+S triggers a Save indicator (cursor position irrelevant)
 *    7. paste       — long string lands in a textarea via insertText (no rhythm).
 *                     The paste section deliberately lives below the fold so
 *                     this step exercises the auto-scroll path before typing.
 *    8. read        — humanized cursor scan across prose during the dwell
 *    9. move        — pure positional motion to a Point, no element under cursor
 *   10. scroll      — humanized scroll all the way down to a destination
 *
 * Run with:
 *   pnpm demo:primitives
 *
 * Compare personalities by re-running with:
 *   PERSONALITY=careful     pnpm demo:primitives   (default)
 *   PERSONALITY=fast        pnpm demo:primitives
 *   PERSONALITY=precise     pnpm demo:primitives
 *   PERSONALITY=distracted  pnpm demo:primitives
 *
 * For deep dives on individual primitives, see `pnpm demo:click`,
 * `pnpm demo:type`, `pnpm demo:read`, `pnpm demo:scroll`.
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

      /* 2. Click */
      .click-button {
        padding: 14px 28px;
        font-size: 15px;
        font-weight: 500;
        font-family: ui-monospace, SF Mono, monospace;
        color: #fff;
        background: linear-gradient(180deg, #334155, #1e293b);
        border: 1px solid #475569;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .click-button.activated {
        background: linear-gradient(180deg, #22c55e, #16a34a);
        border-color: #16a34a;
      }

      /* 3. Right-click */
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

      /* 4. Drag */
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

      /* 5. Type */
      .text-input {
        width: 100%;
        padding: 14px 16px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 14px;
        color: #f5a55c;
        background: #050505;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        outline: none;
      }
      .text-input:focus { border-color: rgba(245, 165, 92, 0.4); }
      .text-input::placeholder { color: #555; }

      /* 6. Paste */
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

      /* 7. Shortcut */
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

      /* 8. Read */
      .read-passage {
        margin: 0;
        font-size: 16px;
        line-height: 1.6;
        color: #b8b3a9;
        max-width: 620px;
      }

      /* Mid-flow spacer that pushes the paste section below the fold so
         the auto-scroll path is exercised when the demo reaches step 7. */
      .below-fold-spacer {
        height: 820px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.25em;
        color: #2a2a2a;
        border-top: 1px dashed #1a1a1a;
        border-bottom: 1px dashed #1a1a1a;
      }

      /* 10. Scroll — spacer pushes the destination below the fold so the
         scroll motion is observable, then a target block at the bottom
         that highlights when the cursor lands inside it. */
      .scroll-spacer {
        height: 720px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.25em;
        color: #2a2a2a;
        border-top: 1px dashed #1a1a1a;
        border-bottom: 1px dashed #1a1a1a;
      }
      .scroll-destination {
        border-color: #f5a55c33;
        background: #0c0b0a;
        transition: all 0.4s ease;
      }
      .scroll-destination.arrived {
        border-color: #f5a55c;
        background: linear-gradient(180deg, #1a1408, #0c0b0a);
      }
      .scroll-destination .marker {
        margin-top: 12px;
        padding: 14px 16px;
        font-family: ui-monospace, SF Mono, monospace;
        font-size: 13px;
        color: #555;
        background: #050505;
        border: 1px solid #2a2a2a;
        border-radius: 8px;
        transition: all 0.4s ease;
      }
      .scroll-destination.arrived .marker {
        color: #f5a55c;
        border-color: #f5a55c66;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <h1>HumanJS primitives</h1>
        <p>Ten things a real user does that scripted automation usually fakes.</p>
      </div>

      <!-- 1. Hover -->
      <div class="block">
        <div class="label"><span class="num">1</span> hover</div>
        <div class="tooltip-host" id="tooltip-target">
          ?
          <div class="tip">Hover-only UI works because the cursor really moves here.</div>
        </div>
      </div>

      <!-- 2. Click -->
      <div class="block">
        <div class="label"><span class="num">2</span> click</div>
        <button id="click-button" class="click-button" type="button">Activate</button>
      </div>

      <!-- 3. Right-click -->
      <div class="block">
        <div class="label"><span class="num">3</span> rightClick</div>
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

      <!-- 4. Drag -->
      <div class="block">
        <div class="label"><span class="num">4</span> drag</div>
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

      <!-- 5. Type -->
      <div class="block">
        <div class="label"><span class="num">5</span> type &amp; clear</div>
        <input id="type-input" class="text-input" placeholder="email" autocomplete="off" spellcheck="false" />
      </div>

      <!-- 6. Shortcut -->
      <div class="block">
        <div class="label"><span class="num">6</span> press</div>
        <div class="save-host">
          <div class="doc">document — type to edit</div>
          <div class="save-indicator" id="save-indicator">unsaved</div>
        </div>
      </div>

      <!-- 7. Paste — positioned far below the fold so the auto-scroll path
           has to fire before the cursor can land on the textarea. -->
      <div class="below-fold-spacer">paste lives below the fold — auto-scroll brings it into view</div>
      <div class="block">
        <div class="label"><span class="num">7</span> paste</div>
        <textarea class="paste-box" id="paste-target" placeholder="long content goes here…" spellcheck="false"></textarea>
      </div>

      <!-- 8. Read -->
      <div class="block">
        <div class="label"><span class="num">8</span> read</div>
        <p id="read-passage" class="read-passage">A real cursor curves between targets. A real keyboard has rhythm. A real reader dwells. HumanJS turns automation into something the reader can't tell apart from a person.</p>
      </div>

      <!-- 9. Move — no UI; the next step parks the cursor in dead space below this section. -->
      <div class="block">
        <div class="label"><span class="num">9</span> move</div>
        <p class="read-passage" style="font-size: 14px; color: #777;">The next beat moves the cursor to a free coordinate — no element under it. Pure positioning, the way you'd place the cursor before a keyboard shortcut or between sections of a demo.</p>
      </div>

      <!-- Spacer that pushes step 10 below the fold so the scroll motion is observable. -->
      <div class="scroll-spacer">scroll down to see the next step</div>

      <!-- 10. Scroll -->
      <div class="block scroll-destination" id="scroll-destination">
        <div class="label"><span class="num">10</span> scroll</div>
        <p class="read-passage">The cursor scrolled all the way down here, with multi-segment wheel motion and mid-scroll pauses — the same shape a real user produces, not a single jumpcut.</p>
        <div class="marker" id="scroll-marker">awaiting cursor…</div>
      </div>
    </div>

    <script>
      // --- 1. hover --- (handled purely by CSS :hover on .tooltip-host)

      // --- 2. click --- visual feedback on activate
      const clickButton = document.getElementById('click-button');
      clickButton.addEventListener('click', () => {
        clickButton.classList.add('activated');
        clickButton.textContent = '✓ Activated';
      });

      // --- 3. rightClick --- custom context menu, suppresses the OS one
      const ctxMenu = document.getElementById('ctx-menu');
      const ctxHost = document.getElementById('ctx-target');
      ctxHost.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ctxMenu.classList.add('visible');
        setTimeout(() => ctxMenu.classList.remove('visible'), 2200);
      });

      // --- 4. drag --- mousedown/move/up on the card, visual feedback on drop
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

      // --- 6. press --- Mod+S handler flashes the save indicator AND
      // surfaces the exact chord that fired so a viewer watching the demo
      // sees "saved ✓ via ⌘S" (Mac) or "saved ✓ via Ctrl+S" (other) —
      // makes it visually obvious that the cross-platform Mod token
      // resolved to the right keycode for the platform.
      const saveIndicator = document.getElementById('save-indicator');
      window.addEventListener('keydown', (e) => {
        const isSaveCombo = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S');
        if (isSaveCombo) {
          e.preventDefault();
          const chord = e.metaKey ? '⌘S' : 'Ctrl+S';
          saveIndicator.classList.add('saved');
          saveIndicator.textContent = 'saved ✓  via ' + chord;
          setTimeout(() => {
            saveIndicator.classList.remove('saved');
            saveIndicator.textContent = 'unsaved';
          }, 1800);
        }
      });

      // --- 10. scroll --- IntersectionObserver lights up the destination
      // when it scrolls into view. Gives a visible "you made it" signal so
      // the scroll step has a payoff at the end.
      const dest = document.getElementById('scroll-destination');
      const marker = document.getElementById('scroll-marker');
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            dest.classList.add('arrived');
            marker.textContent = '✓ scrolled here';
          }
        }
      }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
      observer.observe(dest);
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
  console.log(
    'Demoing: hover → click → rightClick → drag → type & clear → press → paste → read → move → scroll\n',
  );

  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.setContent(DEMO_HTML);
    await installMouseHelper(context);

    const human = await createHuman(page, { personality, seed: 'primitives-demo' });
    await human.sleep(800);

    // 1. Hover — cursor moves to the "?" icon, tooltip reveals via CSS.
    console.log('1. hover → tooltip target');
    await human.hover('#tooltip-target');
    await human.sleep(1200);

    // 2. Click — basic Bezier-path click on a button. Visible state change
    // confirms the click landed.
    console.log('2. click → button');
    await human.click('#click-button');
    await human.sleep(900);

    // 3. Right-click — custom context menu opens on contextmenu event.
    console.log('3. rightClick → context menu');
    await human.rightClick('#ctx-target');
    await human.sleep(1500);

    // 4. Drag — card from one slot to another, then a slider drag using a
    // Point coordinate to demo the Point variant. The slider's target Y
    // tracks the thumb's actual position (not a hardcoded coordinate) so
    // the drag lands on the track instead of floating above it across
    // different viewport sizes.
    console.log('4. drag → card to slot, then slider thumb to point');
    await human.drag('#drag-card', '#slot-to');
    await human.sleep(900);
    // The slider drag is element → raw-`Point`. The library's per-endpoint
    // auto-scroll will bring the slider into the viewport center if it's
    // off-fold, and the raw `Point`'s y will shift with the scroll
    // delta — preserving the "same height as the thumb" relationship the
    // caller intended. No explicit pre-scroll needed; this is a regular
    // canvas/SVG-style drag where the destination is a coordinate.
    const thumbBox = await page.locator('#slider-thumb').boundingBox();
    const trackBox = await page.locator('.slider-track').boundingBox();
    if (thumbBox && trackBox) {
      const targetX = trackBox.x + trackBox.width * 0.85;
      const targetY = thumbBox.y + thumbBox.height / 2;
      await human.drag('#slider-thumb', { x: targetX, y: targetY });
    }
    await human.sleep(900);

    // 5. Type & clear — same field, two primitives. `human.type()` implicitly
    // clicks the input first (watch the cursor land before the keys) and types
    // with a humanized per-key rhythm. Then `clear` (select-all + delete) wipes
    // it and we retype the corrected value — the realistic "edit an existing
    // value" flow. `clear` has no element of its own, so it shares this field.
    console.log('5. type & clear → type into the input, then wipe it and retype');
    await human.type('#type-input', 'demo@humanjs.dev');
    await human.sleep(900);
    console.log('   ↳ clear → select-all + delete, then retype the corrected value');
    await human.clear('#type-input');
    await human.sleep(700);
    await human.type('#type-input', 'gonzalo@humanjs.dev');
    await human.sleep(900);

    // 6. Press — Mod+S triggers the page's save handler, indicator flashes.
    // The input from the previous step is still focused; cursor position is
    // irrelevant to which element receives a key press — only focus matters.
    console.log('6. press → Mod+S triggers Save (against the focused input)');
    await human.press('Mod+S');
    await human.sleep(2000);

    // 7. Paste — the paste section lives below an 820px spacer, so its
    // textarea sits well below the fold when this step starts. The
    // auto-scroll path inside the locator resolver should bring the
    // textarea into view *before* the cursor walk — without it, the
    // cursor would move to an off-viewport coordinate and the paste would
    // silently miss the field.
    console.log('7. paste → auto-scroll brings the textarea into view, then pastes');
    await human.paste('#paste-target', LONG_PASTE_VALUE);
    await human.sleep(900);

    // 8. Read — humanized cursor scan across the prose during the dwell.
    // `read` auto-detects 'prose' from the <p> tag and uses the personality's
    // WPM × jitter math for the dwell duration.
    console.log('8. read → dwell on the passage with cursor scan');
    await human.read('#read-passage');
    await human.sleep(800);

    // 9. Move — pure positional motion to a Point with no element under it.
    // Parks the cursor in dead space above the scroll spacer. Watch the
    // cursor settle without any element-bound interaction firing.
    console.log('9. move → cursor to a point in dead space');
    await human.move({ x: 460, y: 540 });
    await human.sleep(1200);

    // 10. Scroll — humanized scroll to the destination at the bottom of the
    // page. Multi-segment wheel motion with mid-scroll pauses, not a single
    // jumpcut. The destination block highlights when it scrolls into view
    // (IntersectionObserver in the page script), giving a visible payoff.
    console.log('10. scroll → to the destination at the bottom');
    await human.scroll('#scroll-destination');
    await human.sleep(2500);

    console.log('\nDone. Browser will stay open for 5 seconds.');
    console.log(
      'Tip: re-run with PERSONALITY=distracted to see typos, overshoot, and wider scatter.',
    );
    console.log(
      '     For deep dives on individual primitives, see pnpm demo:click, demo:type, etc.',
    );
    await human.sleep(5000);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
