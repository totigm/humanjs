import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import type { CaptureResult } from './capture';
import { generateHumanJS, generatePlaywrightTest, type PlaywrightTestOptions } from './codegen';

export type { PlaywrightTestOptions } from './codegen';
export { generateHumanJS, generatePlaywrightTest } from './codegen';
export type {
  ReplayOptions,
  ReplayResult,
  ReplayStepResult,
  ReplayStepUpdate,
} from './replay';
export { replayTimeline } from './replay';

// Safety net for captured-frame temp dirs: every live Recording registers
// its dir here, and a single lazy `process.on('exit')` handler sweeps
// whatever's left when the process ends. The OS would eventually reap
// `os.tmpdir()` anyway, but cleaning on exit avoids the "100 demo runs and
// now /tmp has 20GB of frames" failure mode. Explicit `dispose()` removes
// from this set so we don't double-clean.
const pendingFrameCleanups = new Set<string>();
let exitHandlerInstalled = false;

function ensureExitHandler(): void {
  if (exitHandlerInstalled) return;
  exitHandlerInstalled = true;
  process.on('exit', () => {
    for (const dir of pendingFrameCleanups) {
      try {
        // Sync rm — `process.on('exit')` can't await Promises. The dirs are
        // small (frames already encoded into the user's output by now in
        // most cases), so the blocking shutdown cost is negligible.
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Swallow — exit-phase cleanup can race the OS or hit a perms
        // issue we can't recover from anyway. Worst case: the OS reaps
        // tmpdir on its own schedule.
      }
    }
    pendingFrameCleanups.clear();
  });
}

// `ffmpeg-static` returns the absolute path of a bundled ffmpeg binary at
// require time, or `null` on platforms it can't support. We resolve once.
const FFMPEG_PATH = ffmpegStatic as unknown as string | null;

/**
 * Encoding quality preset. Picks the per-frame capture quality + the
 * ffmpeg encode settings used to assemble them into a video.
 *
 * - `'fast'` — JPEG q=85, CRF 23, preset fast (iteration)
 * - `'standard'` — JPEG q=90, CRF 20, preset fast (balanced)
 * - `'high'` (default) — JPEG q=95, CRF 18, preset slow, tune animation (marketing-grade)
 * - `'lossless'` — PNG capture, CRF 12, preset veryslow (archival; huge temp files)
 */
export type RecordingQuality = 'fast' | 'high' | 'lossless' | 'standard';

/** ffmpeg `-preset` values, ordered from fastest to slowest. */
export type FfmpegPreset =
  | 'fast'
  | 'faster'
  | 'medium'
  | 'slow'
  | 'slower'
  | 'superfast'
  | 'ultrafast'
  | 'veryfast'
  | 'veryslow';

/** ffmpeg `-tune` values for libx264. */
export type FfmpegTune =
  | 'animation'
  | 'fastdecode'
  | 'film'
  | 'grain'
  | 'stillimage'
  | 'zerolatency';

interface QualityPreset {
  readonly crf: number;
  readonly preset: FfmpegPreset;
  readonly tune?: FfmpegTune;
  /** Per-frame capture format used to source the frames. */
  readonly captureFormat: 'jpeg' | 'png';
  readonly captureJpegQuality: number;
  /** Target capture FPS — the polling rate for `page.screenshot()`. */
  readonly captureFps: number;
}

const QUALITY_PRESETS: Record<RecordingQuality, QualityPreset> = {
  fast: {
    captureFormat: 'jpeg',
    captureJpegQuality: 85,
    captureFps: 24,
    crf: 23,
    preset: 'fast',
  },
  standard: {
    captureFormat: 'jpeg',
    captureJpegQuality: 90,
    captureFps: 30,
    crf: 20,
    preset: 'fast',
  },
  high: {
    captureFormat: 'jpeg',
    captureJpegQuality: 95,
    captureFps: 30,
    crf: 18,
    preset: 'slow',
    // 'animation' suits screen content (large solid regions, sharp edges)
    // better than 'film' which is tuned for live-action grain.
    tune: 'animation',
  },
  lossless: {
    // PNG capture for perceptually lossless source frames. Temp files are
    // 10-20× larger than JPEG; output mp4 still benefits from the extra
    // headroom (no JPEG artifacts to preserve).
    captureFormat: 'png',
    captureJpegQuality: 100,
    captureFps: 30,
    crf: 12,
    preset: 'veryslow',
    tune: 'animation',
  },
};

/** Returns the capture-side settings for a quality preset. */
export function getCaptureSettingsForQuality(quality: RecordingQuality): {
  readonly format: 'jpeg' | 'png';
  readonly quality: number;
  readonly fps: number;
} {
  const preset = QUALITY_PRESETS[quality];
  return {
    format: preset.captureFormat,
    quality: preset.captureJpegQuality,
    fps: preset.captureFps,
  };
}

/** Options for {@link Recording.toVideo}. */
export interface ToVideoOptions {
  /** Encoding quality preset. Defaults to `'high'`. */
  readonly quality?: RecordingQuality;
  /** Override CRF (0–51, lower = better). Defaults to the quality preset's CRF. */
  readonly crf?: number;
  /** Override ffmpeg `-preset`. Defaults to the quality preset's preset. */
  readonly preset?: FfmpegPreset;
  /** Override ffmpeg `-tune`. Defaults to the quality preset's tune (if any). */
  readonly tune?: FfmpegTune;
}

/** Options for {@link Recording.toGif}. */
export interface ToGifOptions {
  /**
   * Frames per second of the output GIF. Defaults to `15` — high enough for
   * smooth motion in most renderers, low enough to keep file size sane.
   * Renderers cap GIF playback around 50fps anyway.
   */
  readonly fps?: number;
  /**
   * Scale the GIF to this width (pixels). Height is computed to preserve
   * aspect ratio. Omit to keep the source viewport size — but most embedded
   * GIFs (README, PR, Slack) look fine at 640–960px and weigh a fraction.
   */
  readonly width?: number;
}

/** One action captured during a recording, as emitted in {@link Timeline.events}. */
export interface TimelineEvent {
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** Offset (ms) from the recording start when the action began. */
  readonly tMs: number;
  readonly durationMs: number;
  /** Error message, present only if the action threw. */
  readonly error?: string;
  /**
   * For `type` / `paste`: the actual text written, captured when
   * `captureInputs` is on (the default). Omitted when capture is off or the
   * target is a password field (always masked). Flows into exported code.
   */
  readonly inputValue?: string;
}

/** Structured action timeline of a recording. */
export interface Timeline {
  readonly version: 1;
  /** Optional label for the recording (used as the generated test's title). */
  readonly name?: string;
  readonly personality: string;
  readonly seed: string | null;
  readonly speed: string;
  readonly durationMs: number;
  readonly events: readonly TimelineEvent[];
}

/** Metadata passed from `human.record()` into the Recording constructor. */
export interface RecordingTimelineSource {
  readonly name?: string;
  readonly personality: string;
  readonly seed: string | null;
  readonly speed: string;
  readonly events: readonly TimelineEvent[];
}

/**
 * A recorded window of a humanized session. Returned by `human.record(cb)`.
 *
 * A Recording can hold a frame capture (`hasVideo === true`) OR be
 * timeline-only (`hasVideo === false`). `toVideo()` / `toGif()` require a
 * capture; `toTimeline()` and `.timeline` work either way.
 *
 * The video exporters are repeatable and interleavable — they read the
 * captured frames without consuming them. Calling `dispose()` is OPTIONAL:
 * the captured-frames temp dir is also swept by a `process.on('exit')`
 * handler installed on first use, so casual scripts can skip it entirely.
 * Call `dispose()` (or use `await using`) when you want to release the
 * frames proactively — long-running services, batch jobs, etc.
 */
export class Recording {
  readonly #capture: CaptureResult | null;
  readonly #windowStartMs: number;
  readonly #windowEndMs: number;
  readonly #timelineSource: RecordingTimelineSource;
  // Frames live on disk until `dispose()` is called. Exporters
  // (`toVideo`, `toGif`) are repeatable and interleavable — they read the
  // same frame source, they don't consume it.
  #disposed = false;

  constructor(
    capture: CaptureResult | null,
    windowStartMs: number,
    windowEndMs: number,
    timelineSource: RecordingTimelineSource,
  ) {
    this.#capture = capture;
    this.#windowStartMs = windowStartMs;
    this.#windowEndMs = windowEndMs;
    this.#timelineSource = timelineSource;

    // Register the captured-frames dir for sweep-on-exit. If the user
    // forgets to call `dispose()`, the process-exit handler still cleans
    // it up — so casual scripts don't have to think about lifecycle.
    if (capture !== null) {
      pendingFrameCleanups.add(capture.dir);
      ensureExitHandler();
    }
  }

  /** Wall-clock duration of the recorded window. */
  get durationMs(): number {
    return this.#windowEndMs - this.#windowStartMs;
  }

  /** True if frames were captured during this recording. */
  get hasVideo(): boolean {
    return this.#capture !== null;
  }

  /**
   * The structured action timeline of this recording — same data that
   * `toTimeline()` writes to disk.
   */
  get timeline(): Timeline {
    return {
      version: 1,
      ...(this.#timelineSource.name !== undefined ? { name: this.#timelineSource.name } : {}),
      personality: this.#timelineSource.personality,
      seed: this.#timelineSource.seed,
      speed: this.#timelineSource.speed,
      durationMs: this.durationMs,
      events: this.#timelineSource.events,
    };
  }

  /**
   * Assembles the captured frames into a video at `outputPath`. The output
   * format is inferred from the extension — `.mp4` (H.264, re-encoded
   * with the configured quality) or `.webm` (VP9).
   *
   * Repeatable and interleavable with `toGif()` — the frame source is read,
   * not consumed. Frames live until you call `dispose()` (or `await using`
   * goes out of scope, or the process exits and the OS reaps `tmpdir`).
   *
   * @returns the resolved output path.
   */
  async toVideo(outputPath: string, options: ToVideoOptions = {}): Promise<string> {
    if (this.#disposed) {
      throw new Error('Recording.toVideo() called after dispose() — the source frames are gone.');
    }
    if (this.#capture === null) {
      throw new Error(
        'Recording.toVideo() requires video capture, which was disabled for this recording. ' +
          'Call `human.record(cb)` (default captures video) or pass `output` to ' +
          "@humanjs/recorder's `record()`. `toTimeline()` and `.timeline` work without capture.",
      );
    }

    const preset = QUALITY_PRESETS[options.quality ?? 'high'];
    const crf = options.crf ?? preset.crf;
    const ffmpegPreset = options.preset ?? preset.preset;
    const tune = options.tune ?? preset.tune;

    const { dir, frames, startedAtMs, stoppedAtMs } = this.#capture;
    if (frames.length === 0) {
      throw new Error(
        'No frames were captured. The recording window may have been too short, ' +
          'or the page may not have rendered any frames before the callback completed.',
      );
    }

    await mkdir(dirname(outputPath), { recursive: true });

    const ext = extname(outputPath).toLowerCase();
    if (ext !== '.mp4' && ext !== '.webm') {
      throw new Error(`Unsupported output extension: ${ext || '(none)'}. Use .mp4 or .webm.`);
    }

    // Use a concat-demuxer file with per-frame duration so the assembled
    // video matches the real-world capture timing. Handles uneven frame
    // intervals from the polling loop.
    const concatPath = `${dir}/concat.txt`;
    const concatBody = buildConcatFile(frames, stoppedAtMs - startedAtMs);
    await writeFile(concatPath, concatBody, 'utf8');

    const args: string[] = ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-vsync', 'vfr'];

    if (ext === '.mp4') {
      args.push(
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        String(crf),
        '-preset',
        ffmpegPreset,
      );
      if (tune) args.push('-tune', tune);
      args.push('-movflags', '+faststart');
    } else {
      // .webm via libvpx-vp9 — lossless friendly, good gradient handling.
      args.push(
        '-c:v',
        'libvpx-vp9',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        String(crf),
        '-b:v',
        '0',
        '-deadline',
        ffmpegPreset === 'fast' || ffmpegPreset === 'veryfast' ? 'realtime' : 'good',
      );
    }

    args.push(outputPath);
    await runFfmpeg(args);

    return outputPath;
  }

  /**
   * Assembles the captured frames into an animated GIF at `outputPath`.
   * Optimized for embedding in READMEs, PRs, Slack, and docs — uses a
   * per-recording palette (`palettegen` + `paletteuse`) with Bayer dithering
   * so gradients stay smooth without exploding the file size.
   *
   * Repeatable and interleavable with `toVideo()` — call them in any order,
   * any number of times. Frames live until you call `dispose()`.
   *
   * @returns the resolved output path.
   */
  async toGif(outputPath: string, options: ToGifOptions = {}): Promise<string> {
    if (this.#disposed) {
      throw new Error('Recording.toGif() called after dispose() — the source frames are gone.');
    }
    if (this.#capture === null) {
      throw new Error(
        'Recording.toGif() requires video capture, which was disabled for this recording. ' +
          'Call `human.record(cb)` (default captures video) or pass `output` to ' +
          "@humanjs/recorder's `record()`. `toTimeline()` and `.timeline` work without capture.",
      );
    }

    const fps = options.fps ?? 15;
    const width = options.width;

    const { dir, frames, startedAtMs, stoppedAtMs } = this.#capture;
    if (frames.length === 0) {
      throw new Error(
        'No frames were captured. The recording window may have been too short, ' +
          'or the page may not have rendered any frames before the callback completed.',
      );
    }

    await mkdir(dirname(outputPath), { recursive: true });

    const ext = extname(outputPath).toLowerCase();
    if (ext !== '.gif') {
      throw new Error(`Unsupported output extension: ${ext || '(none)'}. Use .gif.`);
    }

    const concatPath = `${dir}/concat.txt`;
    const concatBody = buildConcatFile(frames, stoppedAtMs - startedAtMs);
    await writeFile(concatPath, concatBody, 'utf8');

    // Filter graph: drop to the target fps, optionally scale, then run the
    // standard split → palettegen → paletteuse pattern. `stats_mode=diff`
    // weights changing pixels more heavily so the palette favors regions
    // that actually move; Bayer dither at scale 5 is the usual sweet spot
    // for screen content (sharp edges, large flat regions).
    const filterSteps: string[] = [`fps=${fps}`];
    if (width !== undefined) {
      filterSteps.push(`scale=${width}:-1:flags=lanczos`);
    }
    const preFilter = filterSteps.join(',');
    const filterComplex =
      `${preFilter},split [a][b]; ` +
      `[a] palettegen=stats_mode=diff [p]; ` +
      `[b][p] paletteuse=dither=bayer:bayer_scale=5`;

    const args: string[] = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatPath,
      '-filter_complex',
      filterComplex,
      '-loop',
      '0',
      outputPath,
    ];
    await runFfmpeg(args);

    return outputPath;
  }

  /**
   * Writes the structured action timeline to `outputPath` as JSON.
   * Independent of `toVideo()` / `toGif()` — call before, after, in between,
   * or instead. Safe to call multiple times. Unaffected by `dispose()`
   * (the timeline lives in memory, not in the captured-frames temp dir).
   *
   * @returns the resolved output path.
   */
  async toTimeline(outputPath: string): Promise<string> {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(this.timeline, null, 2)}\n`, 'utf8');
    return outputPath;
  }

  /**
   * Generates a standalone, runnable HumanJS script from the timeline and
   * writes it to `outputPath`. String selectors round-trip verbatim; typed
   * values are included when `captureInputs` was on (passwords masked).
   *
   * Independent of frame capture — works on timeline-only recordings and is
   * unaffected by `dispose()`.
   *
   * @returns the resolved output path.
   */
  async toHumanJS(outputPath: string): Promise<string> {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, generateHumanJS(this.timeline), 'utf8');
    return outputPath;
  }

  /**
   * Generates a `@playwright/test` spec from the timeline — a humanized test
   * (uses `createHuman` + `human.*`), not raw Playwright — and writes it to
   * `outputPath`. Runs instant in CI / recorded speed locally, drops timing
   * `sleep()`s (pass `{ keepSleeps: true }` to keep them), and derives the
   * assertions it safely can.
   *
   * Independent of frame capture — works on timeline-only recordings and is
   * unaffected by `dispose()`.
   *
   * @returns the resolved output path.
   */
  async toPlaywright(outputPath: string, options?: PlaywrightTestOptions): Promise<string> {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, generatePlaywrightTest(this.timeline, options), 'utf8');
    return outputPath;
  }

  /**
   * Releases the captured-frames temp directory. After this call, `toVideo()`
   * and `toGif()` throw — but `toTimeline()` and the in-memory `timeline`
   * still work because those don't depend on the frames.
   *
   * **Optional.** A process-exit handler also sweeps any un-disposed frame
   * dirs, so casual scripts can skip this entirely. Call it explicitly when
   * you want to release frames proactively (long-running services, batch
   * jobs, or anywhere you want predictable disk usage).
   *
   * Idempotent. Safe to call on a Recording that never had a capture
   * (timeline-only mode) — no-op there.
   *
   * Also wired to `Symbol.asyncDispose`, so the explicit-resource-management
   * `await using` syntax (TypeScript ≥ 5.2 / Node ≥ 20.4) works:
   *
   * ```ts
   * await using rec = await human.record(fn);
   * await rec.toVideo('demo.mp4');
   * await rec.toGif('demo.gif');
   * // frames cleaned up automatically when `rec` goes out of scope
   * ```
   */
  async dispose(): Promise<void> {
    if (this.#disposed) return;
    if (this.#capture !== null) {
      await this.#capture.cleanup();
      // Only unregister from the exit-sweep AFTER cleanup succeeds — if
      // cleanup throws, the sweep stays armed as a last-resort fallback.
      pendingFrameCleanups.delete(this.#capture.dir);
    }
    this.#disposed = true;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }
}

/**
 * Builds an ffmpeg concat-demuxer file describing each captured frame and
 * its duration in seconds. The last frame's duration is the gap to the
 * stop timestamp.
 */
function buildConcatFile(
  frames: readonly { readonly path: string; readonly tMs: number }[],
  totalMs: number,
): string {
  const lines: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i] as { readonly path: string; readonly tMs: number };
    const next = frames[i + 1];
    const nextTMs = next ? next.tMs : totalMs;
    const durationS = Math.max(0.001, (nextTMs - frame.tMs) / 1000);
    lines.push(`file '${frame.path.replaceAll("'", "'\\''")}'`);
    lines.push(`duration ${durationS.toFixed(6)}`);
  }
  // ffmpeg's concat demuxer requires the final entry repeated without
  // duration so the encoder doesn't drop the last frame.
  const last = frames[frames.length - 1];
  if (last) {
    lines.push(`file '${last.path.replaceAll("'", "'\\''")}'`);
  }
  return `${lines.join('\n')}\n`;
}

function runFfmpeg(args: readonly string[]): Promise<void> {
  if (!FFMPEG_PATH) {
    return Promise.reject(
      new Error(
        'ffmpeg-static did not bundle a binary for this platform. ' +
          'Install system ffmpeg and set FFMPEG_PATH, or run on a supported platform.',
      ),
    );
  }
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG_PATH, [...args]);
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}\n${stderr.trim()}`));
    });
  });
}
