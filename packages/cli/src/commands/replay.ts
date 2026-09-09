/**
 * `humanjs replay <timeline.json>` — re-run a recorded session and report
 * whether it still works.
 *
 * This is the half of the loop that was already built and unreachable:
 * `replayTimeline` has returned per-step pass/fail since the recorder
 * shipped, but nothing outside the library could call it. Exposing it
 * turns a recorded JSON into a regression check with no test framework
 * and no code — `--record out.json` to capture, `replay` to verify.
 *
 * The exit code is the point. Anything a CI job runs has to fail loudly,
 * so a failed step exits 1 and names the step that broke.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  chromium,
  installMouseHelper,
  type ReplayStepUpdate,
  recordReplay,
  replayTimeline,
} from '@humanjs/playwright';
import {
  type CliOptions,
  DEFAULT_PERSONALITY,
  DEFAULT_SPEED,
  PERSONALITIES,
  type Personality,
  SPEEDS,
  type SpeedName,
  UsageError,
} from '../args';
import { assertRecordFormat, exportRecording } from '../export';
import { applyMedia } from '../media';
import { parseTimelineText, type TimelineFile } from '../timeline';

/** What a settled step looked like, accumulated as the replay streams. */
interface StepOutcome {
  readonly index: number;
  readonly type: string;
  readonly status: 'pass' | 'fail';
  readonly error?: string;
}

/**
 * Resolves a setting from, in order: the flag the user passed, the value
 * the timeline was recorded with, then the default.
 *
 * The middle term is the one that matters. A timeline captured as
 * `distracted` replays differently under `careful`, so reproducing the
 * recorded conditions is the only sane default for a regression check —
 * and `replayTimeline` on its own does not do this, it always starts from
 * `careful`/`human`.
 */
export function resolveSetting<T extends string>(
  flag: T | undefined,
  recorded: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (flag !== undefined) return flag;
  if (recorded !== undefined && (allowed as readonly string[]).includes(recorded)) {
    return recorded as T;
  }
  return fallback;
}

/** `1.2s`, or `840ms` under a second — a bare ms count reads as noise. */
export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Renders the closing summary. Kept separate from the run so the wording
 * is unit-testable — this line is what a person reads in a CI log, and it
 * has to say which step died without them opening anything else.
 */
export function formatSummary(steps: readonly StepOutcome[], total: number, ms: number): string {
  const failed = steps.find((step) => step.status === 'fail');
  if (!failed) {
    return `PASS  ${total} step${total === 1 ? '' : 's'} · ${formatDuration(ms)}`;
  }
  return `FAIL  step ${failed.index + 1} of ${total} (${failed.type}) · ${formatDuration(ms)}`;
}

async function loadTimeline(path: string): Promise<{ timeline: TimelineFile; label: string }> {
  const absolute = resolve(path);
  let text: string;
  try {
    text = await readFile(absolute, 'utf8');
  } catch {
    throw new UsageError(`Timeline not found: ${absolute}`);
  }
  return { timeline: parseTimelineText(text, path), label: path };
}

/** Returns true when every step passed. */
export async function runReplay(path: string, options: CliOptions): Promise<boolean> {
  // Checked before anything else so a bad --record extension fails instantly.
  if (options.record) assertRecordFormat(options.record);
  const { timeline, label } = await loadTimeline(path);

  const personality = resolveSetting<Personality>(
    options.personality,
    timeline.personality,
    PERSONALITIES,
    DEFAULT_PERSONALITY,
  );
  const speed = resolveSetting<SpeedName>(options.speed, timeline.speed, SPEEDS, DEFAULT_SPEED);
  const seed = options.seed ?? timeline.seed ?? undefined;
  const total = timeline.events.length;

  console.log(`replaying ${label} — ${total} steps (${personality}, ${speed})\n`);

  const steps: StepOutcome[] = [];
  const onStep = (update: ReplayStepUpdate): void => {
    // Only settled steps are printed. Rendering "running" would need
    // cursor control to overwrite, and ANSI escapes turn CI logs to soup.
    if (update.status === 'running') return;
    steps.push({
      index: update.index,
      type: update.type,
      status: update.status,
      ...(update.error !== undefined ? { error: update.error } : {}),
    });
    const mark = update.status === 'pass' ? '✓' : '✗';
    const n = String(update.index + 1).padStart(String(total).length, ' ');
    console.log(`  ${mark}  ${n}  ${update.type}`);
    if (update.error) console.log(`        ${update.error.split('\n')[0]}`);
  };

  const replayOptions = {
    personality,
    speed,
    onStep,
    ...(seed !== undefined ? { seed } : {}),
  };

  const browser = await chromium.launch({ headless: options.headless });
  const startedAt = Date.now();
  try {
    const context = await browser.newContext({ viewport: options.viewport });
    if (options.timeoutMs !== undefined) context.setDefaultTimeout(options.timeoutMs);
    await installMouseHelper(context);
    const page = await context.newPage();
    await applyMedia(page, options);

    if (options.record) {
      // recordReplay returns the Recording but discards the ReplayResult,
      // so the verdict comes from the same onStep stream either way. That
      // keeps one code path for the summary instead of two.
      const clip = await recordReplay(page, timeline.events, replayOptions);
      await exportRecording(clip, options.record);
    } else {
      await replayTimeline(page, timeline.events, replayOptions);
    }
  } finally {
    await browser.close();
  }

  const elapsed = Date.now() - startedAt;
  console.log(`\n  ${formatSummary(steps, total, elapsed)}`);
  if (options.record) console.log(`  recorded to ${options.record}`);

  return steps.every((step) => step.status === 'pass') && steps.length === total;
}
