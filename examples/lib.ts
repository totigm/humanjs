/**
 * Shared helpers for the runnable demos in this workspace.
 */

import type { PresetName } from '@humanjs/playwright';

/**
 * The four built-in personality preset names. Kept in sync manually with
 * `@humanjs/core`'s preset list — the brief explicitly limits built-ins to
 * four, so this is stable.
 */
export const VALID_PERSONALITIES: readonly PresetName[] = [
  'careful',
  'distracted',
  'fast',
  'precise',
];

/**
 * Parses a personality name from an env var with a clear error on invalid input.
 * Exits the process with code 1 if `value` is non-empty but not a known preset.
 */
export function parsePersonality(
  value: string | undefined,
  fallback: PresetName,
  varName: string,
): PresetName {
  if (!value) return fallback;
  if (!VALID_PERSONALITIES.includes(value as PresetName)) {
    console.error(
      `Invalid ${varName}: "${value}". Must be one of: ${VALID_PERSONALITIES.join(', ')}`,
    );
    process.exit(1);
  }
  return value as PresetName;
}
