import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext } from 'playwright';
import type { CapturedAction } from './types';

let injectedSource: string | null = null;

/** The bundled in-page recorder (dist/injected.js), read once and cached. */
function loadInjectedScript(): string {
  if (injectedSource === null) {
    const dir = dirname(fileURLToPath(import.meta.url));
    injectedSource = readFileSync(join(dir, 'injected.js'), 'utf8');
  }
  return injectedSource;
}

function isCapturedAction(value: unknown): value is CapturedAction {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { params?: unknown }).params === 'object'
  );
}

/**
 * A main-frame navigation within this window of the last in-page gesture
 * (pointerdown / keydown) is treated as a *consequence* of that gesture — a
 * clicked link, a submitted form, a typed search that updates the URL. The
 * gesture is already recorded and reproduces the navigation on replay, so we
 * don't also record a `goto` (which would navigate a second time). Navigations
 * with no recent gesture — the initial load, or the user typing a URL in the
 * address bar — are still captured.
 */
const NAV_AFTER_GESTURE_MS = 2500;

/** Sentinel action the recorder pings on each gesture; bumps the clock, never a step. */
const NAV_INTENT = '__navIntent';

/**
 * A scroll-to-top within this window of a navigation is the framework's
 * scroll-restoration (SPA routers reset to `(0,0)` on navigate), not a user
 * scroll — drop it so the timeline isn't littered with no-op `scroll({to:0})`.
 */
const NAV_SCROLL_RESET_MS = 1500;

/** Scroll offset of a `scroll` action if it targets the top of the page, else null. */
function scrollTopOffset(action: CapturedAction): number | null {
  if (action.type !== 'scroll') return null;
  const match = /^to:(\d+)$/.exec(String(action.params.target ?? ''));
  if (!match) return null;
  const offset = Number(match[1]);
  return offset <= 3 ? offset : null;
}

/**
 * Attach interaction capture to a browser context: expose the `__humanjsEmit`
 * binding the recorder calls, inject the recorder into every page, and report
 * main-frame navigations as `goto` actions. Each captured action is handed to
 * `onAction` in the order it occurred.
 *
 * Must be called before the first page is created so the init script and
 * binding apply to it.
 */
export async function attachCapture(
  context: BrowserContext,
  onAction: (action: CapturedAction) => void,
): Promise<void> {
  // Timestamps used to tell user-driven steps from navigation side-effects.
  let lastGestureAt = 0;
  let lastNavAt = 0;

  await context.exposeBinding('__humanjsEmit', (_source, action: unknown) => {
    if (!isCapturedAction(action)) return;
    lastGestureAt = Date.now();
    // Gesture pings only advance the clock — they aren't timeline steps.
    if (action.type === NAV_INTENT) return;
    // Drop the scroll-to-top a SPA router fires right after navigating — it's
    // scroll-restoration, not a user scroll, and would replay as a no-op.
    if (scrollTopOffset(action) !== null && Date.now() - lastNavAt < NAV_SCROLL_RESET_MS) return;
    onAction(action);
  });
  await context.addInitScript({ content: loadInjectedScript() });

  // Main-frame navigations become `goto` steps. Dedupe consecutive identical
  // URLs (a single navigation can fire more than once) and ignore blanks.
  let lastUrl = '';
  context.on('page', (page) => {
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      if (!url || url === 'about:blank' || url === lastUrl) return;
      lastUrl = url;
      lastNavAt = Date.now();
      // Skip navigations that are the consequence of a just-recorded gesture
      // (clicked link, form submit, search-as-you-type) — replaying the gesture
      // navigates on its own; a `goto` here would double-navigate.
      if (Date.now() - lastGestureAt < NAV_AFTER_GESTURE_MS) return;
      onAction({ type: 'goto', params: { url } });
    });
  });
}
