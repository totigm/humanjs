/// <reference lib="dom" />

import type { BrowserContext, Page } from 'playwright';

/**
 * Canonical HumanJS cursor path — kept in lockstep with the SVG used by the
 * web app's `HumanCursorIcon`. Inlined here so the playwright package has no
 * dependency on `@humanjs/web` or DOM assets.
 */
const CURSOR_PATH = 'M 0 0 L 16 6 L 8 9.5 L 5 19 Z';

/** Options for {@link installMouseHelper}. */
export interface InstallMouseHelperOptions {
  /** Cursor fill color. Defaults to the HumanJS amber `#f5a55c`. */
  readonly color?: string;
  /** Cursor visual size in pixels. Defaults to 22. */
  readonly size?: number;
  /**
   * Render a ripple at each `mousedown` position so clicks read on video.
   * Defaults to `true`.
   */
  readonly showClicks?: boolean;
  /** Halo opacity behind the cursor. Defaults to `0.18`. */
  readonly haloOpacity?: number;
}

/**
 * Installs a visual cursor overlay that follows every `mousemove` on each
 * page in the target. Real synthetic motion from Playwright (e.g.
 * `human.click()`, `human.read(..., { withMotion: true })`) is *already*
 * happening — the page just doesn't render a system cursor for it. This
 * helper injects a HumanJS-styled SVG cursor that listens to mousemove
 * events and follows them, making the motion visible in headed demos and
 * screen recordings.
 *
 * Re-runs on every navigation via `addInitScript`, so the overlay survives
 * page reloads. Idempotent — guard flag on `window` prevents double-install.
 *
 * Accepts either a `Page` (overlay applies to that page) or a
 * `BrowserContext` (overlay applies to every page in the context, including
 * pages opened later).
 *
 * @example
 * ```ts
 * const browser = await chromium.launch({ headless: false });
 * const context = await browser.newContext();
 * await installMouseHelper(context);
 * const page = await context.newPage();
 * // human-driven actions are now visible in the page
 * ```
 */
export async function installMouseHelper(
  target: BrowserContext | Page,
  options: InstallMouseHelperOptions = {},
): Promise<void> {
  const config: HelperConfig = {
    color: options.color ?? '#f5a55c',
    stroke: '#020203',
    size: options.size ?? 22,
    showClicks: options.showClicks ?? true,
    haloOpacity: options.haloOpacity ?? 0.18,
    path: CURSOR_PATH,
  };

  // Register for every future navigation. Survives goto, reload, and frame
  // attachment without needing to re-install.
  await target.addInitScript(installScript, config);

  // ALSO inject into any pages that already exist. Without this, a page that
  // has already loaded (via goto or setContent) won't get the overlay until
  // the next navigation — and `page.setContent()` in particular replaces the
  // document, wiping anything the initial init-script run appended. Pages
  // opened later still get the overlay via the registered init script.
  const pages: Page[] = 'pages' in target ? target.pages() : [target];
  await Promise.all(
    pages.map((page) => page.evaluate(installScript, config).catch(() => undefined)),
  );
}

interface HelperConfig {
  color: string;
  stroke: string;
  size: number;
  showClicks: boolean;
  haloOpacity: number;
  path: string;
}

/**
 * Serialized into the page and re-run on every navigation. No closures —
 * everything threads through `config`. `window` and `document` are the
 * page's globals at runtime, not the Node-side types.
 */
function installScript(config: HelperConfig) {
  const guardKey = '__humanjsMouseHelperInstalled';
  const w = window as Window & { [guardKey]?: boolean };
  if (w[guardKey]) return;
  w[guardKey] = true;

  const attach = () => {
    const cursor = document.createElement('div');
    cursor.setAttribute('aria-hidden', 'true');
    cursor.setAttribute('data-humanjs-cursor', 'true');
    cursor.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      `width: ${config.size}px`,
      `height: ${config.size + 4}px`,
      'pointer-events: none',
      'z-index: 2147483647',
      // Start visible at (0, 0) so the cursor is on screen from the moment
      // the page loads — without this the helper looks like nothing happened
      // until the first mousemove arrives.
      'opacity: 1',
      'transform: translate(0px, 0px)',
      // CSS interpolates between successive `mousemove` updates so the
      // cursor reads as continuous motion instead of discrete hops. Slightly
      // longer than the path-walker's typical step interval (~30–80ms) so
      // each tween is still settling when the next move lands → no pauses.
      'transition: transform 110ms ease-out, opacity 0.18s ease-out',
      'will-change: transform',
    ].join('; ');
    const haloRadius = Math.round(config.size * 0.6);
    cursor.innerHTML = `
      <svg width="${config.size}" height="${config.size + 4}" viewBox="0 0 22 24" style="overflow: visible;">
        <circle cx="0" cy="0" r="${haloRadius}" fill="${config.color}" opacity="${config.haloOpacity}" />
        <path d="${config.path}" fill="${config.color}" stroke="${config.stroke}" stroke-width="0.7" stroke-linejoin="round" />
      </svg>
    `;
    document.body.appendChild(cursor);

    let lastX = 0;
    let lastY = 0;
    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      cursor.style.transform = `translate(${lastX}px, ${lastY}px)`;
      cursor.style.opacity = '1';
    };
    // Listen on both window and document so we catch synthetic mouse events
    // dispatched at either level (Playwright sends them via CDP, and the
    // target frame can vary by event source).
    window.addEventListener('mousemove', onMove, { capture: true, passive: true });
    document.addEventListener('mousemove', onMove, { capture: true, passive: true });
    document.addEventListener(
      'mouseleave',
      () => {
        cursor.style.opacity = '0';
      },
      { capture: true, passive: true },
    );

    if (config.showClicks) {
      const styleEl = document.createElement('style');
      styleEl.textContent =
        '@keyframes humanjs-ripple { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(2); opacity: 0; } }';
      document.head.appendChild(styleEl);

      window.addEventListener(
        'mousedown',
        () => {
          const ripple = document.createElement('div');
          ripple.style.cssText = [
            'position: fixed',
            `left: ${lastX}px`,
            `top: ${lastY}px`,
            'width: 28px',
            'height: 28px',
            'border-radius: 50%',
            `border: 1.5px solid ${config.color}`,
            'pointer-events: none',
            'z-index: 2147483646',
            'animation: humanjs-ripple 0.45s ease-out forwards',
          ].join('; ');
          document.body.appendChild(ripple);
          window.setTimeout(() => ripple.remove(), 500);
        },
        { capture: true, passive: true },
      );
    }
  };

  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });
}
