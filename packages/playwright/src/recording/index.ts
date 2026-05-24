import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import type { CaptureResult } from './capture';

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

/** One action captured during a recording, as emitted in {@link Timeline.events}. */
export interface TimelineEvent {
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
  /** Offset (ms) from the recording start when the action began. */
  readonly tMs: number;
  readonly durationMs: number;
  /** Error message, present only if the action threw. */
  readonly error?: string;
}

/** Structured action timeline of a recording. */
export interface Timeline {
  readonly version: 1;
  readonly personality: string;
  readonly seed: string | null;
  readonly speed: string;
  readonly durationMs: number;
  readonly events: readonly TimelineEvent[];
}

/** Metadata passed from `human.record()` into the Recording constructor. */
export interface RecordingTimelineSource {
  readonly personality: string;
  readonly seed: string | null;
  readonly speed: string;
  readonly events: readonly TimelineEvent[];
}

/**
 * A recorded window of a humanized session. Returned by `human.record(cb)`.
 *
 * A Recording can hold a frame capture (`hasVideo === true`) OR be
 * timeline-only (`hasVideo === false`). `toVideo()` requires a capture;
 * `toTimeline()` and `.timeline` work either way.
 *
 * `toVideo()` is single-use because it cleans up the captured frame temp
 * directory after assembly.
 */
export class Recording {
  readonly #capture: CaptureResult | null;
  readonly #windowStartMs: number;
  readonly #windowEndMs: number;
  readonly #timelineSource: RecordingTimelineSource;
  #finalized = false;

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
   * Single-use: the source frames are cleaned up after assembly.
   *
   * @returns the resolved output path.
   */
  async toVideo(outputPath: string, options: ToVideoOptions = {}): Promise<string> {
    if (this.#finalized) {
      throw new Error('Recording.toVideo() can only be called once per recording.');
    }
    if (this.#capture === null) {
      throw new Error(
        'Recording.toVideo() requires video capture, which was disabled for this recording. ' +
          'Call `human.record(cb)` (default captures video) or pass `output` to ' +
          "@humanjs/recorder's `record()`. `toTimeline()` and `.timeline` work without capture.",
      );
    }
    this.#finalized = true;

    const preset = QUALITY_PRESETS[options.quality ?? 'high'];
    const crf = options.crf ?? preset.crf;
    const ffmpegPreset = options.preset ?? preset.preset;
    const tune = options.tune ?? preset.tune;

    const { dir, frames, startedAtMs, stoppedAtMs } = this.#capture;
    if (frames.length === 0) {
      await this.#capture.cleanup();
      throw new Error(
        'No frames were captured. The recording window may have been too short, ' +
          'or the page may not have rendered any frames before the callback completed.',
      );
    }

    try {
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

      const args: string[] = [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatPath,
        '-vsync',
        'vfr',
      ];

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
    } finally {
      await this.#capture.cleanup();
    }
  }

  /**
   * Writes the structured action timeline to `outputPath` as JSON.
   * Independent of `toVideo()` — call before, after, or instead. Safe to
   * call multiple times.
   *
   * @returns the resolved output path.
   */
  async toTimeline(outputPath: string): Promise<string> {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(this.timeline, null, 2)}\n`, 'utf8');
    return outputPath;
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
