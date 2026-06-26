import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type PresetName, replayTimeline } from '@humanjs/playwright';
import { chromium } from 'playwright';
import { attachCapture } from './capture/attach';
import { type ExportFormat, generateCode } from './export';
import { openInBrowser } from './open-browser';
import type { ClientMessage, ServerMessage } from './protocol';
import { createDashboardServer } from './server';
import { TimelineStore } from './timeline-store';

/** Built-in personalities the dashboard switcher offers. */
const PERSONALITIES = ['careful', 'fast', 'distracted', 'precise'] as const;

/** Default output filenames per format, written to the CLI's working directory. */
const OUTPUT_FILE: Record<ExportFormat, string> = {
  spec: 'humanjs-recording.spec.ts',
  script: 'humanjs-recording.ts',
};

/**
 * Launch a recording session: start the local dashboard, open a real Chromium
 * window at `targetUrl`, capture interactions into an editable timeline, and let
 * the dashboard curate it (delete / reorder / relabel / edit / pick selectors /
 * add assertions / mark secrets / switch personality) with a live code preview,
 * then export a `.spec.ts` / `.ts`. Runs until the browser closes or the
 * process is interrupted.
 */
export async function start(targetUrl: string): Promise<void> {
  const server = await createDashboardServer();
  const store = new TimelineStore();
  let personality: PresetName = 'careful';
  // Assigned once the browser launches (below); the replay handler — only
  // reachable via a dashboard command, which can't arrive before launch —
  // closes over it.
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  let replayController: AbortController | null = null;

  const previewCode = (): string => generateCode(store.list(), { format: 'spec', personality });

  const stateMessage = (): ServerMessage => ({
    type: 'state',
    targetUrl,
    steps: store.list(),
    personality,
    personalities: [...PERSONALITIES],
    code: previewCode(),
  });

  const broadcastState = (): void => server.broadcast(stateMessage());

  const exportTimeline = async (format: ExportFormat): Promise<void> => {
    const path = resolve(process.cwd(), OUTPUT_FILE[format]);
    await writeFile(path, generateCode(store.list(), { format, personality }), 'utf8');
    server.broadcast({ type: 'exported', path });
    console.log(`  Exported ${format === 'spec' ? 'test' : 'script'} → ${path}`);
  };

  // Replay the curated timeline in a fresh, capture-free window (so it can't
  // re-record itself), streaming per-step results to the dashboard. Stops at
  // the first failure; cancellable; the window is always closed afterwards.
  const runReplay = async (): Promise<void> => {
    if (replayController) return; // a run is already in flight
    const steps = store.list();
    if (steps.length === 0) return;
    const stepId = (index: number): string | undefined => steps[index]?.id;
    const controller = new AbortController();
    replayController = controller;
    server.broadcast({ type: 'replayStarted' });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    const startedAt = Date.now();
    try {
      const result = await replayTimeline(page, steps, {
        personality,
        signal: controller.signal,
        onStep: ({ index, status, error }) => {
          const id = stepId(index);
          if (id) server.broadcast({ type: 'replayStep', id, status, ...(error ? { error } : {}) });
        },
      });
      const failedStepId =
        result.failedIndex === undefined ? undefined : stepId(result.failedIndex);
      server.broadcast({
        type: 'replayDone',
        status: result.status,
        durationMs: result.durationMs,
        ...(failedStepId ? { failedStepId } : {}),
      });
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === 'AbortError';
      server.broadcast({
        type: 'replayDone',
        status: 'fail',
        aborted,
        durationMs: Date.now() - startedAt,
        ...(aborted ? {} : { error: cause instanceof Error ? cause.message : String(cause) }),
      });
    } finally {
      await context.close().catch(() => {});
      replayController = null;
    }
  };

  const handleCommand = (message: ClientMessage): void => {
    switch (message.type) {
      case 'delete':
        store.delete(message.id);
        break;
      case 'move':
        store.move(message.id, message.toIndex);
        break;
      case 'reorder':
        store.reorder(message.ids);
        break;
      case 'update':
        store.update(message.id, message.patch);
        break;
      case 'addAssert':
        store.addAssert(message.afterId, message.kind, message.target, message.value);
        break;
      case 'setPersonality':
        if ((PERSONALITIES as readonly string[]).includes(message.personality)) {
          // Guarded by the includes() check above — it's one of PERSONALITIES.
          personality = message.personality as PresetName;
        }
        break;
      case 'export':
        void exportTimeline(message.format);
        return; // export replies with `exported`, not a state refresh
      case 'replay':
        void runReplay();
        return; // replay streams its own `replay*` messages
      case 'cancelReplay':
        replayController?.abort();
        return;
    }
    broadcastState();
  };

  server.wss.on('connection', (socket) => {
    socket.send(JSON.stringify(stateMessage()));
    socket.on('message', (data) => {
      try {
        handleCommand(JSON.parse(data.toString()) as ClientMessage);
      } catch {
        // Ignore malformed frames.
      }
    });
  });

  browser = await chromium.launch({ headless: false });
  // `viewport: null` lets the page fill the real window — a person drives this.
  const context = await browser.newContext({ viewport: null });
  // Attach capture before the first page exists so the init script applies.
  await attachCapture(context, (action) => {
    store.append({
      type: action.type,
      params: action.params,
      tMs: 0,
      durationMs: 0,
      ...(action.inputValue === undefined ? {} : { inputValue: action.inputValue }),
    });
    broadcastState();
  });
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
