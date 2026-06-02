import { chromium } from 'playwright';
import { openInBrowser } from './open-browser';
import type { ServerMessage } from './protocol';
import { createDashboardServer } from './server';

/**
 * Launch a recording session: start the local dashboard, open a real Chromium
 * window at `targetUrl`, and keep both alive until the user closes the browser
 * or interrupts the process.
 *
 * This is the milestone-2 skeleton — capture and export wire into the same
 * dashboard channel in later milestones.
 */
export async function start(targetUrl: string): Promise<void> {
  const server = await createDashboardServer();

  // Greet each client as it connects so a late-opening tab still learns which
  // site is being recorded.
  server.wss.on('connection', (socket) => {
    const hello: ServerMessage = { type: 'hello', targetUrl };
    socket.send(JSON.stringify(hello));
  });

  const browser = await chromium.launch({ headless: false });
  // `viewport: null` lets the page fill the real window — this is a live
  // session a person drives, not a fixed-size automated run.
  const context = await browser.newContext({ viewport: null });
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
  // Quitting the Chromium window ends the session too.
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
