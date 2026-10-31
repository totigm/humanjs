/**
 * `humanjs compare <url>` — the side-by-side, generated for your own site.
 *
 * `CLAUDE.md` names a robotic-vs-humanized side-by-side as the hero asset
 * every marketing surface links to. Until now only this repo could make
 * one, against a synthetic page. This makes one of *your* site, which is
 * the version anybody actually wants to share.
 *
 * The robotic lane is not a simulation of bad automation: it is
 * `speed: 'instant'`, a documented mode that bypasses humanization and
 * runs as straight Playwright. Both lanes execute the identical tour, so
 * the only variable on screen is the motion.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { record } from '@humanjs/recorder';
import type { Page } from 'playwright';
import { type CliOptions, DEFAULT_PERSONALITY, type Personality } from '../args';
import { assertRecordFormat } from '../export';
import { stackVideos } from '../stack';
import { tour } from './demo';

/** Where the composed file lands when `--record` is not given. */
export const DEFAULT_OUTPUT = 'humanjs-compare.mp4';

/**
 * Paints a lane label over the page.
 *
 * Done in CSS through `body::before` rather than burned in with ffmpeg's
 * `drawtext`: that filter needs a font file on the host, which is exactly
 * the kind of thing that works on one machine and not the next. The
 * browser already has fonts.
 */
export function laneLabelCss(text: string, accent: string): string {
  return `
    body::before {
      content: ${JSON.stringify(text)};
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 2147483647;
      padding: 10px 0;
      background: #020203;
      color: ${accent};
      font: 600 12px/1.4 ui-monospace, "SF Mono", monospace;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      text-align: center;
      pointer-events: none;
    }
  `;
}

/** One recorded lane. */
interface Lane {
  readonly path: string;
  readonly durationMs: number;
}

async function recordLane(
  url: string,
  outputPath: string,
  label: string,
  accent: string,
  options: CliOptions,
  speed: 'instant' | 'human',
  personality: Personality,
): Promise<Lane> {
  const rec = await record(
    {
      output: outputPath,
      name: label,
      personality,
      speed,
      seed: options.seed,
      viewport: options.viewport,
      headless: options.headless,
    },
    async (human, page: Page) => {
      await tour(human, page, url, async (p) => {
        await p.addStyleTag({ content: laneLabelCss(label, accent) });
      });
    },
  );
  return { path: outputPath, durationMs: rec.durationMs };
}

export async function runCompare(url: string, options: CliOptions): Promise<void> {
  const output = options.record ?? DEFAULT_OUTPUT;
  const format = assertRecordFormat(output);
  if (format !== 'video' && format !== 'gif') {
    throw new Error(
      `compare produces a video, so --record needs a .mp4, .webm or .gif filename — got "${output}".`,
    );
  }
  const personality = options.personality ?? DEFAULT_PERSONALITY;

  const dir = await mkdtemp(join(tmpdir(), 'humanjs-compare-'));
  try {
    console.log('recording the Playwright lane (speed: instant)…');
    const left = await recordLane(
      url,
      join(dir, 'left.mp4'),
      'Playwright · no humanization',
      '#8a857c',
      options,
      'instant',
      personality,
    );

    console.log(`recording the HumanJS lane (${personality})…`);
    const right = await recordLane(
      url,
      join(dir, 'right.mp4'),
      `HumanJS · ${personality}`,
      '#f5a55c',
      options,
      'human',
      personality,
    );

    console.log('combining…');
    await stackVideos(left.path, right.path, output, left.durationMs, right.durationMs);

    const ratio = (right.durationMs / Math.max(left.durationMs, 1)).toFixed(1);
    console.log(
      `\n  ${output}\n  Playwright ${(left.durationMs / 1000).toFixed(1)}s · HumanJS ${(right.durationMs / 1000).toFixed(1)}s (${ratio}× longer, and that is the point)`,
    );
  } finally {
    // The lanes are intermediates; only the composed file is wanted.
    await rm(dir, { recursive: true, force: true });
  }
}
