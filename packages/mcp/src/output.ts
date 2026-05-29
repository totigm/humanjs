import { basename, join } from 'node:path';

/**
 * Resolves a user/AI-supplied filename to a safe absolute path inside
 * `outputDir`. Rejects anything with path components (`../`, `sub/dir`,
 * absolute paths) so a prompt-injected filename can't write outside the
 * configured output directory.
 *
 * The AI picks the name; the env (HUMANJS_OUTPUT_DIR) picks the directory.
 */
export function resolveOutputPath(outputDir: string, filename: string): string {
  const base = basename(filename);
  if (base !== filename || base.length === 0) {
    throw new Error(
      `filename must be a plain name with no path components, got "${filename}". Files are always written to HUMANJS_OUTPUT_DIR.`,
    );
  }
  return join(outputDir, base);
}

/** Export format a recording filename maps to. */
export type RecordingFormat = 'video' | 'gif' | 'timeline' | 'humanjs' | 'playwright';

/**
 * Picks a recording's export format from its filename extension.
 * `.spec.ts` / `.test.ts` → a Playwright test; a plain `.ts` → a HumanJS
 * script. Returns `null` for unsupported extensions. Checked before the
 * recording is stopped so a bad name fails without losing the take.
 */
export function resolveRecordingFormat(filename: string): RecordingFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) return 'video';
  if (lower.endsWith('.gif')) return 'gif';
  if (lower.endsWith('.json')) return 'timeline';
  if (lower.endsWith('.spec.ts') || lower.endsWith('.test.ts')) return 'playwright';
  if (lower.endsWith('.ts')) return 'humanjs';
  return null;
}
