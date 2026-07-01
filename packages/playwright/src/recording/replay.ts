import { type PersonalityConfig, sleep } from '@humanjs/core';
import type { Page } from 'playwright';
import {
  createHuman,
  type Human,
  type KeyOrChord,
  type ScrollTarget,
  type SelectOptionValues,
  type Speed,
  type UploadFiles,
} from '../index';
import type { InstallMouseHelperOptions } from '../mouse-helper';
import { startCapture } from './capture';
import {
  Recording,
  type RecordingTimelineSource,
  type Timeline,
  type TimelineEvent,
} from './index';
import { resolveMouseTarget } from './targets';

/** Progress callback payload, fired as each step starts and settles. */
export interface ReplayStepUpdate {
  readonly index: number;
  readonly type: string;
  readonly status: 'running' | 'pass' | 'fail';
  readonly error?: string;
}

/** Outcome of a single replayed step. */
export interface ReplayStepResult {
  readonly index: number;
  readonly type: string;
  readonly status: 'pass' | 'fail';
  readonly error?: string;
}

/** Outcome of a {@link replayTimeline} run. */
export interface ReplayResult {
  readonly status: 'pass' | 'fail';
  readonly steps: readonly ReplayStepResult[];
  /** Index of the failing step, when `status` is `'fail'`. */
  readonly failedIndex?: number;
  readonly durationMs: number;
}

/** Options for {@link replayTimeline}. */
export interface ReplayOptions {
  /** Personality for the replay session. Defaults to `'careful'`. */
  readonly personality?: PersonalityConfig;
  /** Speed mode. Defaults to `'human'` so the replay is watchable. */
  readonly speed?: Speed;
  /** Seed for deterministic motion. */
  readonly seed?: number | string;
  /** Cursor overlay, forwarded to `createHuman` (on by default). */
  readonly cursor?: boolean | InstallMouseHelperOptions;
  /** Called as each step starts (`running`) and settles (`pass` / `fail`). */
  readonly onStep?: (update: ReplayStepUpdate) => void;
  /** Abort an in-flight replay (checked between steps); rejects with an `AbortError`. */
  readonly signal?: AbortSignal;
}

function abortError(): Error {
  const error = new Error('Replay aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Replay a recorded {@link Timeline} against a live `page`, driving it through
 * the same humanized primitives the exported test uses. Runs each event in
 * order and reports per-step pass/fail; **stops at the first failure** (like a
 * real test). `assert` events are checked with plain Playwright APIs — there's
 * no `@playwright/test` dependency — so they approximate `expect` without its
 * auto-retry on text/url.
 *
 * Always resolves with a {@link ReplayResult}; a thrown error means the run
 * itself broke (page closed, or the `signal` aborted → `AbortError`), not a
 * step failure. The caller owns `page`'s lifecycle.
 */
export async function replayTimeline(
  page: Page,
  timeline: Timeline | readonly TimelineEvent[],
  options: ReplayOptions = {},
): Promise<ReplayResult> {
  const events = Array.isArray(timeline) ? timeline : (timeline as Timeline).events;
  const { onStep, signal } = options;
  if (signal?.aborted) throw abortError();

  const human = await createHuman(page, {
    personality: options.personality ?? 'careful',
    speed: options.speed ?? 'human',
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
    ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
  });

  const startedAt = Date.now();
  const steps: ReplayStepResult[] = [];

  for (const [index, event] of events.entries()) {
    if (signal?.aborted) throw abortError();
    onStep?.({ index, type: event.type, status: 'running' });
    try {
      await runEvent(human, page, event);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      steps.push({ index, type: event.type, status: 'fail', error });
      onStep?.({ index, type: event.type, status: 'fail', error });
      return { status: 'fail', steps, failedIndex: index, durationMs: Date.now() - startedAt };
    }
    steps.push({ index, type: event.type, status: 'pass' });
    onStep?.({ index, type: event.type, status: 'pass' });
  }

  return { status: 'pass', steps, durationMs: Date.now() - startedAt };
}

/** Options for {@link recordReplay}. */
export interface RecordReplayOptions extends ReplayOptions {
  /** Capture rate in frames per second. Defaults to 30. */
  readonly fps?: number;
  /** JPEG frame quality (0-100). Defaults to 95. */
  readonly quality?: number;
}

/**
 * Replay a recorded {@link Timeline} against a live `page` while capturing
 * frames, and return a {@link Recording} you can export with `toVideo()` /
 * `toGif()`. The humanized cursor is visible by default — the point of the
 * video is to show the motion. Symmetric with `human.record()`: that captures a
 * live callback; this captures a replayed timeline.
 *
 * Returns the `Recording` regardless of whether the replay passed — a failed
 * step just means the video stops there. Pass `onStep` if you need to observe
 * failures, and verify with {@link replayTimeline} first for a clean take. The
 * caller owns `page`'s lifecycle; `toVideo`/`toGif` read frames from disk, so
 * the page can be closed before exporting.
 */
export async function recordReplay(
  page: Page,
  timeline: Timeline | readonly TimelineEvent[],
  options: RecordReplayOptions = {},
): Promise<Recording> {
  const tl = Array.isArray(timeline) ? null : (timeline as Timeline);
  const events = tl ? tl.events : (timeline as readonly TimelineEvent[]);

  const capture = await startCapture(page, {
    ...(options.fps !== undefined ? { fps: options.fps } : {}),
    ...(options.quality !== undefined ? { quality: options.quality } : {}),
  });
  try {
    await replayTimeline(page, timeline, options);
  } catch (cause) {
    // Infra failure / abort threw — drop the frames and propagate. A failing
    // *step* doesn't throw (replayTimeline returns a result), so its partial
    // frames are kept below.
    await capture.abort();
    throw cause;
  }
  const result = await capture.stop();

  const personality =
    tl?.personality ?? (typeof options.personality === 'string' ? options.personality : 'careful');
  const seed = tl?.seed ?? (options.seed !== undefined ? String(options.seed) : null);
  const timelineSource: RecordingTimelineSource = {
    ...(tl?.name !== undefined ? { name: tl.name } : {}),
    personality,
    seed,
    speed: tl?.speed ?? options.speed ?? 'human',
    events,
  };
  return new Recording(result, result.startedAtMs, result.stoppedAtMs, timelineSource);
}

/** Translate a recorded scroll target back into a {@link ScrollTarget}. */
function parseScrollTarget(target: unknown): ScrollTarget {
  const value = String(target ?? 'natural');
  const by = value.match(/^by:(-?\d+(?:\.\d+)?)$/);
  if (by) return { by: Number(by[1]) };
  const to = value.match(/^to:(-?\d+(?:\.\d+)?)$/);
  if (to) return { to: Number(to[1]) };
  return value;
}

const normalizeText = (value: string | null): string => (value ?? '').replace(/\s+/g, ' ').trim();

/** Evaluate an `assert` step via plain Playwright APIs; throws on mismatch. */
async function runAssert(page: Page, params: Readonly<Record<string, unknown>>): Promise<void> {
  const kind = String(params.kind ?? 'visible');
  if (kind === 'url') {
    const actual = page.url();
    const expected = String(params.value ?? '');
    if (actual !== expected) {
      throw new Error(`expected URL ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    return;
  }
  const locator = page.locator(String(params.target ?? '')).first();
  await locator.waitFor({ state: 'visible' });
  if (kind === 'text') {
    const actual = normalizeText(await locator.textContent());
    const expected = normalizeText(String(params.value ?? ''));
    if (actual !== expected) {
      throw new Error(`expected text ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
}

/**
 * Run one timeline event as a live humanized call — the runtime twin of
 * `codegen.ts`'s `emitAction`. Keep the two in sync when adding event types.
 */
async function runEvent(human: Human, page: Page, event: TimelineEvent): Promise<void> {
  const p = event.params;
  switch (event.type) {
    case 'goto':
      await human.goto(String(p.url ?? ''));
      return;
    case 'click':
      await human.click(resolveMouseTarget(p.target));
      return;
    case 'rightClick':
      await human.rightClick(resolveMouseTarget(p.target));
      return;
    case 'doubleClick':
      await human.doubleClick(resolveMouseTarget(p.target));
      return;
    case 'move':
      await human.move(resolveMouseTarget(p.target));
      return;
    case 'hover':
      await human.hover(String(p.target ?? ''));
      return;
    case 'drag':
      await human.drag(resolveMouseTarget(p.from), resolveMouseTarget(p.to));
      return;
    case 'type':
      await human.type(String(p.target ?? ''), event.inputValue ?? '');
      return;
    case 'paste':
      await human.paste(String(p.target ?? ''), event.inputValue ?? '');
      return;
    case 'clear':
      await human.clear(String(p.target ?? ''));
      return;
    case 'check':
      await human.check(String(p.target ?? ''));
      return;
    case 'uncheck':
      await human.uncheck(String(p.target ?? ''));
      return;
    case 'selectText':
      await human.selectText(
        String(p.target ?? ''),
        typeof p.text === 'string' ? { text: p.text } : undefined,
      );
      return;
    case 'selectOption':
      await human.selectOption(String(p.target ?? ''), p.values as SelectOptionValues);
      return;
    case 'upload':
      await human.upload(String(p.target ?? ''), p.files as UploadFiles);
      return;
    case 'press':
      await human.press(String(p.key ?? '') as KeyOrChord);
      return;
    case 'scroll':
      await human.scroll(parseScrollTarget(p.target));
      return;
    case 'read': {
      const target = String(p.target ?? '');
      // Word-count / char-count placeholders carry no real selector (the
      // original text wasn't captured) — codegen emits a comment; we skip them.
      if (/^\d+ words$/.test(target) || /^text:\d+ chars$/.test(target)) return;
      await human.read(target);
      return;
    }
    case 'sleep':
      await sleep(Number(p.ms) || 0);
      return;
    case 'reload':
      await human.reload();
      return;
    case 'goBack':
      await human.goBack();
      return;
    case 'goForward':
      await human.goForward();
      return;
    case 'assert':
      await runAssert(page, p);
      return;
    default:
      // Unknown / forward-compatible event type — nothing to replay.
      return;
  }
}
