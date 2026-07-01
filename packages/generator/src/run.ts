import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type PresetName, recordReplay, replayTimeline } from '@humanjs/playwright';
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
  // One in-flight replay/export at a time (both pop a fresh window and replay).
  let busy = false;

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
    if (busy) return; // a replay or export is already in flight
    const steps = store.list();
    if (steps.length === 0) return;
    busy = true;
    const stepId = (index: number): string | undefined => steps[index]?.id;
    const controller = new AbortController();
    replayController = controller;
    server.broadcast({ type: 'replayStarted' });
    const startedAt = Date.now();
    // Created inside the try so a newContext/newPage failure still resets state
    // and broadcasts a `replayDone` — otherwise Run would stay disabled and the
    // dashboard would be stuck "running".
    let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    try {
      context = await browser.newContext({ viewport: null });
      const page = await context.newPage();
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
      await context?.close().catch(() => {});
      replayController = null;
      busy = false;
    }
  };

  // Export an .mp4 / .gif: replay the curated timeline in a fresh, capture-free
  // window while capturing frames (recordReplay), then assemble to disk. The
  // user watches the clean replay happen; the window/frames are always released.
  const exportVideo = async (format: 'mp4' | 'gif'): Promise<void> => {
    if (busy) return;
    const steps = store.list();
    if (steps.length === 0) return;
    busy = true;
    const path = resolve(process.cwd(), `humanjs-recording.${format}`);
    let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let recording: Awaited<ReturnType<typeof recordReplay>> | undefined;
    // A failing step doesn't throw (recordReplay returns a partial Recording) —
    // capture the first failure so we can flag the video as truncated.
    let firstFailure: { index: number; type: string; error?: string } | undefined;
    try {
      context = await browser.newContext({ viewport: null });
      const page = await context.newPage();
      recording = await recordReplay(page, steps, {
        personality,
        onStep: ({ index, type, status, error }) => {
          if (status === 'fail' && !firstFailure) {
            firstFailure = { index, type, ...(error ? { error } : {}) };
          }
        },
      });
      if (format === 'mp4') await recording.toVideo(path);
      else await recording.toGif(path);
      const warning = firstFailure
        ? `replay failed at step ${firstFailure.index + 1} (${firstFailure.type})${firstFailure.error ? `: ${firstFailure.error}` : ''}`
        : undefined;
      server.broadcast({ type: 'exported', path, ...(warning ? { partial: true, warning } : {}) });
      console.log(`  Exported ${format} → ${path}${warning ? ` (partial — ${warning})` : ''}`);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      server.broadcast({ type: 'exportFailed', format, error });
      console.warn(`  ${format} export failed: ${error}`);
    } finally {
      await recording?.dispose().catch(() => {});
      await context?.close().catch(() => {});
      busy = false;
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
        if (message.format === 'mp4' || message.format === 'gif') void exportVideo(message.format);
        else void exportTimeline(message.format);
        return; // export replies with `exported` / `exportFailed`, not a state refresh
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
