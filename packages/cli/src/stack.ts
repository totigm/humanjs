/**
 * Side-by-side video composition for `compare`.
 *
 * Two recordings of the same tour are stacked horizontally into one clip.
 * The lanes almost never run for the same length — that is the entire
 * point, since the robotic lane finishes in a fraction of the time — so
 * the shorter one is extended by holding its final frame. Freezing while
 * the other side is still working is the comparison, rendered.
 */

import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

// `ffmpeg-static` exports the absolute path of the bundled binary, typed
// loosely enough that it needs narrowing before use.
const FFMPEG_PATH = ffmpegStatic as unknown as string | null;

/**
 * Builds the `-filter_complex` graph for a two-lane stack.
 *
 * `tpad=stop_mode=clone` repeats the last frame, so the lane that finishes
 * early holds on its final image instead of the stack cutting to whichever
 * side ended first. Exported for its own tests: the arithmetic is easy to
 * get backwards, and getting it backwards pads the lane that was already
 * longest.
 */
export function buildStackFilter(leftMs: number, rightMs: number): string {
  const deficitSeconds = Math.abs(leftMs - rightMs) / 1000;
  const pad = deficitSeconds.toFixed(3);
  const left =
    leftMs < rightMs ? `[0:v]tpad=stop_mode=clone:stop_duration=${pad}[l]` : '[0:v]null[l]';
  const right =
    rightMs < leftMs ? `[1:v]tpad=stop_mode=clone:stop_duration=${pad}[r]` : '[1:v]null[r]';
  // The scale lives inside the graph, not in a -vf flag: ffmpeg refuses
  // -vf and -filter_complex on the same output stream. h264 needs even
  // dimensions, and two stacked lanes can land on an odd width.
  return `${left};${right};[l][r]hstack=inputs=2,scale=trunc(iw/2)*2:trunc(ih/2)*2[v]`;
}

/** Arguments for the stack, split out so the command can log them verbatim. */
export function buildStackArgs(
  leftPath: string,
  rightPath: string,
  outputPath: string,
  leftMs: number,
  rightMs: number,
): string[] {
  return [
    '-y',
    '-i',
    leftPath,
    '-i',
    rightPath,
    '-filter_complex',
    buildStackFilter(leftMs, rightMs),
    '-map',
    '[v]',
    // yuv420p is what makes the result play in browsers and QuickTime
    // rather than only in VLC. The even-dimension scale is folded into the
    // filter graph above, since -vf cannot coexist with -filter_complex.
    '-pix_fmt',
    'yuv420p',
    outputPath,
  ];
}

/** Runs ffmpeg, rejecting with its stderr tail so failures are diagnosable. */
export async function stackVideos(
  leftPath: string,
  rightPath: string,
  outputPath: string,
  leftMs: number,
  rightMs: number,
): Promise<void> {
  if (!FFMPEG_PATH) {
    throw new Error(
      'ffmpeg is unavailable — the bundled ffmpeg-static binary could not be resolved, so the two lanes cannot be combined.',
    );
  }
  const args = buildStackArgs(leftPath, rightPath, outputPath, leftMs, rightMs);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      // ffmpeg is famously chatty; only the tail is ever useful.
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr.trim()}`));
    });
  });
}
