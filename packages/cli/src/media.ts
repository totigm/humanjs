/**
 * CSS media emulation shared by every command.
 *
 * This exists because of a concrete failure: someone using HumanJS to
 * verify a landing page had to ship its reduced-motion path untested,
 * because there was no way to render the page under
 * `prefers-reduced-motion: reduce` short of changing an OS setting.
 *
 * A screenshot cannot settle that question either — reduced motion is
 * about motion, so proving it needs a *recording* made under the
 * condition. That is why these are flags on every command rather than a
 * screenshot-only feature.
 */

import type { Page } from 'playwright';
import type { CliOptions } from './args';

/** Playwright's `emulateMedia` argument, or null when nothing was asked for. */
export type MediaSettings = NonNullable<Parameters<Page['emulateMedia']>[0]>;

/**
 * Builds the emulation payload from the parsed flags.
 *
 * Returns `null` rather than an empty object when no media flag was
 * passed, so callers can skip the call entirely instead of resetting
 * emulation the browser was never doing.
 */
export function buildMediaSettings(options: CliOptions): MediaSettings | null {
  const settings: Record<string, string> = {};
  if (options.reducedMotion) settings.reducedMotion = 'reduce';
  if (options.colorScheme) settings.colorScheme = options.colorScheme;
  if (options.forcedColors) settings.forcedColors = 'active';
  return Object.keys(settings).length > 0 ? (settings as MediaSettings) : null;
}

/** Human-readable summary of what is being emulated, for the run log. */
export function describeMedia(settings: MediaSettings | null): string | null {
  if (!settings) return null;
  const parts: string[] = [];
  const s = settings as Record<string, string | undefined>;
  if (s.reducedMotion) parts.push(`prefers-reduced-motion: ${s.reducedMotion}`);
  if (s.colorScheme) parts.push(`prefers-color-scheme: ${s.colorScheme}`);
  if (s.forcedColors) parts.push(`forced-colors: ${s.forcedColors}`);
  return parts.join(', ');
}

/**
 * Applies the emulation to a page, if any was requested.
 *
 * Called before the first navigation so the page loads under the
 * condition rather than being switched into it afterwards — a site that
 * reads the preference once at boot would otherwise never see it.
 */
export async function applyMedia(page: Page, options: CliOptions): Promise<void> {
  const settings = buildMediaSettings(options);
  if (!settings) return;
  await page.emulateMedia(settings);
}
