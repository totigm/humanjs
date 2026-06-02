import type { TimelineEvent } from '@humanjs/playwright';
import { chromium } from 'playwright';
import { attachCapture } from './capture/attach';
import type { CapturedAction } from './capture/types';
import { openInBrowser } from './open-browser';
import type { ServerMessage } from './protocol';
import { createDashboardServer } from './server';

/**
 * Launch a recording session: start the local dashboard, open a real Chromium
 * window at `targetUrl`, capture the interactions performed there, and stream
 * them to the dashboard as a live timeline. Runs until the user closes the
 * browser or interrupts the process.
 *
 * The captured timeline is held in memory; editing and export wire into the
 * same buffer in later milestones.
 */
export async function start(targetUrl: string): Promise<void> {
  const server = await createDashboardServer();
  const timeline: TimelineEvent[] = [];
  const startedAt = Date.now();

  server.wss.on('connection', (socket) => {
    const hello: ServerMessage = { type: 'hello', targetUrl };
    socket.send(JSON.stringify(hello));
    // Replay the timeline so far so a late-opening dashboard isn't empty.
    for (const event of timeline) {
      socket.send(JSON.stringify({ type: 'event', event } satisfies ServerMessage));
    }
  });

  const onAction = (action: CapturedAction): void => {
    const event: TimelineEvent = {
      type: action.type,
      params: action.params,
      tMs: Date.now() - startedAt,
      durationMs: 0,
      ...(action.inputValue === undefined ? {} : { inputValue: action.inputValue }),
    };
    timeline.push(event);
    server.broadcast({ type: 'event', event });
  };

  const browser = await chromium.launch({ headless: false });
  // `viewport: null` lets the page fill the real window — a person drives this.
  const context = await browser.newContext({ viewport: null });
  // Attach capture before the first page exists so the init script applies.
  await attachCapture(context, onAction);
  const page = await context.newPage();

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await browser.close().catch(() => {});
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
  browser.on('disconnected', () => void shutdown());

  openInBrowser(server.url);

  try {
    await page.goto(targetUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`  Couldn't load ${targetUrl}: ${reason}`);
    console.warn('  Navigate manually in the Chromium window.');
  }

  console.log('');
  console.log('  HumanJS Generator');
  console.log(`  Dashboard:  ${server.url}`);
  console.log(`  Recording:  ${targetUrl}`);
  console.log('');
  console.log('  Interact with the Chromium window. Close it or press Ctrl+C to stop.');
  console.log('');
}
