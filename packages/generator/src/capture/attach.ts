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
  await context.exposeBinding('__humanjsEmit', (_source, action: unknown) => {
    if (isCapturedAction(action)) onAction(action);
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
      onAction({ type: 'goto', params: { url } });
    });
  });
}
