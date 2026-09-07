/**
 * Loading and validating a recorded timeline file.
 *
 * A timeline is what `--record out.json` writes and what `replay` reads
 * back, so it is the one input to this CLI that a user did not type by
 * hand — which is exactly why it needs real validation. A malformed file
 * should say what is wrong with it, not surface a `JSON.parse` stack or,
 * worse, launch a browser and fail thirty seconds later on `undefined is
 * not iterable`.
 */

import { UsageError } from './args';

/**
 * A single recorded action, matching what `replayTimeline` requires.
 *
 * `tMs` and `durationMs` are part of the contract, not decoration, so a
 * file missing them is rejected here rather than blowing up mid-replay
 * with a browser already open.
 */
export interface TimelineEventLike {
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly tMs: number;
  readonly durationMs: number;
}

/**
 * The recorded session. `personality`, `seed` and `speed` are the
 * conditions the capture ran under; `replay` reuses them so a replay
 * reproduces the original rather than imposing fresh defaults.
 */
export interface TimelineFile {
  readonly name?: string;
  readonly personality?: string;
  readonly seed?: string | null;
  readonly speed?: string;
  readonly durationMs?: number;
  readonly events: readonly TimelineEventLike[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates already-parsed JSON as a timeline.
 *
 * Accepts either the object written by `toTimeline()` or a bare array of
 * events, because both round-trip through `replayTimeline` and someone
 * hand-assembling one will reach for the array.
 */
export function parseTimeline(data: unknown, source: string): TimelineFile {
  const events = Array.isArray(data) ? data : isRecord(data) ? data.events : undefined;

  if (!Array.isArray(events)) {
    throw new UsageError(
      `${source} is not a HumanJS timeline: expected an object with an "events" array (or a bare array of events).\n` +
        'Timelines are produced by `--record out.json`, or by `rec.toTimeline()` in the library.',
    );
  }

  if (events.length === 0) {
    throw new UsageError(`${source} contains no events — there is nothing to replay.`);
  }

  const bad = events.findIndex(
    (event) =>
      !isRecord(event) ||
      typeof event.type !== 'string' ||
      typeof event.tMs !== 'number' ||
      typeof event.durationMs !== 'number',
  );
  if (bad !== -1) {
    throw new UsageError(
      `${source} has a malformed event at index ${bad}: every event needs a string "type" and numeric "tMs" and "durationMs".`,
    );
  }

  const meta = isRecord(data) ? data : {};
  return {
    ...(typeof meta.name === 'string' ? { name: meta.name } : {}),
    ...(typeof meta.personality === 'string' ? { personality: meta.personality } : {}),
    ...(typeof meta.seed === 'string' ? { seed: meta.seed } : {}),
    ...(typeof meta.speed === 'string' ? { speed: meta.speed } : {}),
    ...(typeof meta.durationMs === 'number' ? { durationMs: meta.durationMs } : {}),
    events: events as readonly TimelineEventLike[],
  };
}

/** Parses timeline JSON text, reporting a syntax error against its source. */
export function parseTimelineText(text: string, source: string): TimelineFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new UsageError(`${source} is not valid JSON: ${detail}`);
  }
  return parseTimeline(data, source);
}
