import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright';

/**
 * A captured frame in the timer-based capture session. `tMs` is the
 * wall-clock offset (ms) from the capture start.
 */
export interface CapturedFrame {
  readonly path: string;
  readonly tMs: number;
}

/** Outcome of a finalized capture session. */
export interface CaptureResult {
  readonly dir: string;
  readonly frames: readonly CapturedFrame[];
  readonly startedAtMs: number;
  readonly stoppedAtMs: number;
  readonly format: 'jpeg' | 'png';
  readonly fps: number;
  /**
   * Removes the temp directory + all frames. Called automatically by
   * `Recording.toVideo()` after assembly; provided here for the error path.
   */
  cleanup(): Promise<void>;
}

/** Options for {@link startCapture}. */
export interface StartCaptureOptions {
  /**
   * Per-frame compression. `'png'` is lossless but produces large temp files
   * (~5-15 MB/frame at 1080p). `'jpeg'` with `quality` is the sweet spot —
   * quality 95+ is near-imperceptible.
   *
   * Defaults to `'jpeg'`.
   */
  readonly format?: 'jpeg' | 'png';
  /** JPEG quality (0-100). Ignored for PNG. Defaults to 95. */
  readonly quality?: number;
  /**
   * Target capture rate in frames per second. The actual rate may be lower
   * if individual screenshots take longer than the per-frame budget — we
   * never pile up captures, so a slow disk just lowers effective FPS.
   * Defaults to 30.
   */
  readonly fps?: number;
}

/** Live handle returned by {@link startCapture}. */
export interface CaptureSession {
  /** Stops the capture loop and returns the assembled frame list. */
  stop(): Promise<CaptureResult>;
  /**
   * Aborts the capture loop without producing a CaptureResult. Used by the
   * error path so the temp dir doesn't linger.
   */
  abort(): Promise<void>;
}

/**
 * Starts a timer-based capture loop that polls `page.screenshot()` at the
 * configured FPS and writes each frame to a temp directory.
 *
 * Timer-based polling is more reliable than CDP `Page.startScreencast` for
 * the HumanJS use case: the browser only fires screencast events when it
 * re-renders, which means long `sleep()` gaps between actions show up as
 * captured-frame gaps too. Polling gives consistent FPS regardless of
 * what the page is doing.
 *
 * Caller is responsible for invoking either `stop()` (happy path) or
 * `abort()` (error path) to release resources.
 */
export async function startCapture(
  page: Page,
  options: StartCaptureOptions = {},
): Promise<CaptureSession> {
  const format = options.format ?? 'jpeg';
  const quality = options.quality ?? 95;
  const fps = Math.max(1, Math.min(60, options.fps ?? 30));
  const intervalMs = 1000 / fps;

  const dir = await mkdtemp(join(tmpdir(), 'humanjs-capture-'));
  const frames: CapturedFrame[] = [];
  const ext = format === 'png' ? 'png' : 'jpg';

  let stopped = false;
  let frameIndex = 0;
  // Tracks the chain of in-flight captures so stop()/abort() can wait for
  // disk writes to settle before returning.
  let pendingChain: Promise<void> = Promise.resolve();

  const startedAtMs = Date.now();

  const captureLoop = async (): Promise<void> => {
    while (!stopped) {
      const loopStart = Date.now();
      try {
        const buf = await page.screenshot({
          type: format === 'jpeg' ? 'jpeg' : 'png',
          quality: format === 'jpeg' ? quality : undefined,
        });
        if (stopped) return;
        const idx = frameIndex++;
        const path = join(dir, `frame_${String(idx).padStart(6, '0')}.${ext}`);
        const tMs = loopStart - startedAtMs;
        const writePromise = writeFile(path, buf).then(() => {
          frames.push({ path, tMs });
        });
        pendingChain = pendingChain.then(() => writePromise);
      } catch (err) {
        // Page closed mid-capture, or screenshot otherwise failed. Bail
        // cleanly rather than crashing the loop.
        if (stopped) return;
        console.warn('humanjs capture: screenshot failed, stopping loop:', err);
        stopped = true;
        return;
      }
      const elapsed = Date.now() - loopStart;
      const wait = intervalMs - elapsed;
      if (wait > 0) await sleep(wait);
    }
  };

  // Kick off the loop but don't await — it runs until stop()/abort().
  const loopPromise = captureLoop();

  const finish = async (): Promise<void> => {
    stopped = true;
    await loopPromise;
    await pendingChain;
  };

  return {
    async stop(): Promise<CaptureResult> {
      await finish();
      const stoppedAtMs = Date.now();
      return {
        dir,
        frames: [...frames].sort((a, b) => a.tMs - b.tMs),
        startedAtMs,
        stoppedAtMs,
        format,
        fps,
        cleanup: () => rm(dir, { recursive: true, force: true }).then(() => undefined),
      };
    },
    async abort(): Promise<void> {
      await finish();
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
