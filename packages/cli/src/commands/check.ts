/**
 * `humanjs check <url>` — render a page under the accessibility and
 * theming conditions a real user's machine can be in, and report which
 * of them the page actually responds to.
 *
 * Four screenshots on their own are four screenshots someone has to
 * compare by eye. The useful part is the comparison: a condition that
 * renders byte-identical to the baseline is a page that very likely has
 * no branch for it, and that is a finding you can act on.
 *
 * The honest exception is reduced motion, which is about motion. A still
 * frame cannot prove that path either way, so this says so instead of
 * implying a verdict it cannot support.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@humanjs/playwright';
import type { Page } from 'playwright';
import type { CliOptions } from '../args';
import type { MediaSettings } from '../media';

/** Where the screenshots land when `--out` is not given. */
export const DEFAULT_OUT_DIR = 'humanjs-check';

/** One rendering condition to capture. */
export interface Condition {
  readonly name: string;
  readonly media: MediaSettings | null;
  /**
   * Whether a still frame can meaningfully show this condition's effect.
   * False for reduced motion: the difference is in movement, not layout.
   */
  readonly visibleInStill: boolean;
}

export const CONDITIONS: readonly Condition[] = [
  { name: 'baseline', media: null, visibleInStill: true },
  { name: 'dark', media: { colorScheme: 'dark' }, visibleInStill: true },
  { name: 'light', media: { colorScheme: 'light' }, visibleInStill: true },
  { name: 'forced-colors', media: { forcedColors: 'active' }, visibleInStill: true },
  { name: 'reduced-motion', media: { reducedMotion: 'reduce' }, visibleInStill: false },
];

/** Stable fingerprint of a rendered frame. */
export function fingerprint(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 12);
}

export interface ConditionResult {
  readonly name: string;
  readonly file: string;
  readonly changed: boolean;
  readonly visibleInStill: boolean;
}

/**
 * Renders the per-condition verdict.
 *
 * Kept pure so the wording is testable — this is the output someone acts
 * on, and the reduced-motion caveat is the line most likely to be
 * misread if it drifts.
 */
export function describeResult(result: ConditionResult): string {
  if (result.name === 'baseline') return `  ${result.name.padEnd(14)} ${result.file}`;
  if (!result.visibleInStill) {
    return (
      `  ${result.name.padEnd(14)} ${result.file}\n` +
      '                 a still cannot show this — record under it instead:\n' +
      '                 humanjs demo <url> --reduced-motion --record motion.mp4'
    );
  }
  const verdict = result.changed
    ? 'renders differently from baseline'
    : 'identical to baseline — the page may have no branch for it';
  return `  ${result.name.padEnd(14)} ${result.file}\n                 ${verdict}`;
}

export async function runCheck(url: string, options: CliOptions): Promise<void> {
  const outDir = options.outDir ?? DEFAULT_OUT_DIR;
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: options.headless });
  const results: ConditionResult[] = [];
  try {
    const context = await browser.newContext({ viewport: options.viewport });
    if (options.timeoutMs !== undefined) context.setDefaultTimeout(options.timeoutMs);
    const page: Page = await context.newPage();

    let baseline: string | null = null;
    for (const condition of CONDITIONS) {
      // Emulation is set before navigating so a page that reads the
      // preference once at boot still sees it.
      await page.emulateMedia(
        condition.media ?? { colorScheme: null, reducedMotion: null, forcedColors: null },
      );
      await page.goto(url, { waitUntil: 'load' });
      const buffer = await page.screenshot({ fullPage: true });

      const file = join(outDir, `${condition.name}.png`);
      await writeFile(file, buffer);

      const hash = fingerprint(buffer);
      if (condition.name === 'baseline') baseline = hash;
      results.push({
        name: condition.name,
        file,
        changed: baseline !== null && hash !== baseline,
        visibleInStill: condition.visibleInStill,
      });
    }
  } finally {
    await browser.close();
  }

  console.log(`\nchecked ${url} at ${options.viewport.width}×${options.viewport.height}\n`);
  for (const result of results) console.log(describeResult(result));
}
