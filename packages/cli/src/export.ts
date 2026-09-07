/**
 * Extension dispatch for `--record`.
 *
 * The recorder's own `record({ output })` only distinguishes `.gif` from
 * video, so routing a `.spec.ts` through it silently produces an mp4 with
 * the wrong name. The CLI advertises five formats, so it owns the mapping
 * for all five.
 *
 * Splitting validation from the export is deliberate: the extension is
 * checked before the browser launches, so a typo costs milliseconds
 * instead of a full run that ends with nothing usable.
 */

import type { Recording } from '@humanjs/playwright';
import { UsageError } from './args';

export type RecordFormat = 'video' | 'gif' | 'timeline' | 'humanjs' | 'playwright';

/**
 * Maps a filename to its export format, or `null` if unsupported.
 *
 * `.spec.ts` and `.test.ts` are checked before the bare `.ts` case: both
 * end in `.ts`, and the more specific one has to win or every Playwright
 * test would be written as a standalone script.
 */
export function resolveRecordFormat(filename: string): RecordFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) return 'video';
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.json')) return 'timeline';
  if (lower.endsWith('.spec.ts') || lower.endsWith('.test.ts')) return 'playwright';
  if (lower.endsWith('.ts')) return 'humanjs';
  return null;
}

/** Throws unless `filename` maps to a supported format. Call before running. */
export function assertRecordFormat(filename: string): RecordFormat {
  const format = resolveRecordFormat(filename);
  if (format === null) {
    throw new UsageError(
      `Cannot record to "${filename}" — the extension picks the format, and this one is not supported.\n` +
        '  .mp4 .webm  video\n' +
        '  .gif        animated GIF\n' +
        '  .json       timeline (replay it with `humanjs replay`)\n' +
        '  .spec.ts    Playwright test\n' +
        '  .ts         HumanJS script',
    );
  }
  return format;
}

/** Writes the recording in the format its filename implies. */
export async function exportRecording(recording: Recording, filename: string): Promise<void> {
  switch (assertRecordFormat(filename)) {
    case 'video':
      await recording.toVideo(filename);
      return;
    case 'gif':
      await recording.toGif(filename);
      return;
    case 'timeline':
      await recording.toTimeline(filename);
      return;
    case 'playwright':
      await recording.toPlaywright(filename);
      return;
    case 'humanjs':
      await recording.toHumanJS(filename);
      return;
  }
}

/**
 * Whether a format needs captured frames.
 *
 * Only video and GIF do. Timelines and the two code exports are built
 * from the action log, so capturing screenshots for them would pay the
 * screenshot-and-disk cost for nothing — which is exactly why the
 * recorder gates capture on an output path being present.
 */
export function recordNeedsFrames(format: RecordFormat): boolean {
  return format === 'video' || format === 'gif';
}
