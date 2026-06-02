import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TimelineEvent } from '@humanjs/playwright';
import { chromium } from 'playwright';
import { attachCapture } from './capture/attach';
import type { CapturedAction } from './capture/types';
import { type ExportFormat, generateCode } from './export';
import { openInBrowser } from './open-browser';
import type { ClientMessage, ServerMessage } from './protocol';
import { createDashboardServer } from './server';

/** Default output filenames per format, written to the CLI's working directory. */
const OUTPUT_FILE: Record<ExportFormat, string> = {
  spec: 'humanjs-recording.spec.ts',
  script: 'humanjs-recording.ts',
};

/**
 * Launch a recording session: start the local dashboard, open a real Chromium
 * window at `targetUrl`, capture the interactions performed there, stream them
 * to the dashboard as a live timeline with a live code preview, and write a
 * `.spec.ts` / `.ts` when the user exports. Runs until the user closes the
 * browser or interrupts the process.
 */
export async function start(targetUrl: string): Promise<void> {
  const server = await createDashboardServer();
  const timeline: TimelineEvent[] = [];
  const startedAt = Date.now();

  // The live preview is always the spec form (the runnable test). Export lets
  // the user pick spec or standalone script.
  const previewCode = (): string => generateCode(timeline, { format: 'spec' });

  const sendInitial = (socket: { send(data: string): void }): void => {
    socket.send(JSON.stringify({ type: 'hello', targetUrl } satisfies ServerMessage));
    for (const event of timeline) {
      socket.send(JSON.stringify({ type: 'event', event } satisfies ServerMessage));
    }
    socket.send(JSON.stringify({ type: 'code', code: previewCode() } satisfies ServerMessage));
  };

  const exportTimeline = async (format: ExportFormat): Promise<void> => {
    const path = resolve(process.cwd(), OUTPUT_FILE[format]);
    await writeFile(path, generateCode(timeline, { format }), 'utf8');
    server.broadcast({ type: 'exported', path });
    console.log(`  Exported ${format === 'spec' ? 'test' : 'script'} → ${path}`);
  };

  server.wss.on('connection', (socket) => {
    sendInitial(socket);
    socket.on('message', (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (message.type === 'export') void exportTimeline(message.format);
    });
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
    server.broadcast({ type: 'code', code: previewCode() });
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
