import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from './capture';
import { Recording, type RecordingTimelineSource } from './index';

const EMPTY_TIMELINE: RecordingTimelineSource = {
  personality: 'careful',
  seed: null,
  speed: 'human',
  events: [],
};

/**
 * Synthesizes a CaptureResult for tests that don't need to round-trip real
 * ffmpeg output. Pass `frameCount: 0` to exercise the "no frames captured"
 * error path; otherwise we write `frameCount` real (tiny) JPEG files to a
 * temp dir so the concat demuxer would have something to read if we did
 * invoke ffmpeg.
 */
async function makeCaptureResult(frameCount: number): Promise<CaptureResult> {
  const dir = await mkdtemp(join(tmpdir(), 'humanjs-rec-test-'));
  // The smallest valid JPEG byte sequence (1×1 black pixel).
  const tinyJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xd9,
  ]);

  const frames: { readonly path: string; readonly tMs: number }[] = [];
  for (let i = 0; i < frameCount; i++) {
    const path = join(dir, `frame_${String(i).padStart(6, '0')}.jpg`);
    await writeFile(path, tinyJpeg);
    frames.push({ path, tMs: i * 40 });
  }

  return {
    dir,
    frames,
    startedAtMs: 1000,
    stoppedAtMs: 1000 + frameCount * 40,
    format: 'jpeg',
    fps: 25,
    cleanup: () => rm(dir, { recursive: true, force: true }).then(() => undefined),
  };
}

describe('Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('accepts a CaptureResult — video mode', async () => {
      const capture = await makeCaptureResult(2);
      try {
        const rec = new Recording(capture, 2000, 3000, EMPTY_TIMELINE);
        expect(rec.hasVideo).toBe(true);
      } finally {
        await capture.cleanup();
      }
    });

    it('accepts null — timeline-only mode', () => {
      const rec = new Recording(null, 0, 100, EMPTY_TIMELINE);
      expect(rec.hasVideo).toBe(false);
    });
  });

  describe('durationMs', () => {
    it('returns the window end minus window start', () => {
      const rec = new Recording(null, 3000, 5000, EMPTY_TIMELINE);
      expect(rec.durationMs).toBe(2000);
    });
  });

  describe('toVideo error paths', () => {
    it('throws when capture is null (timeline-only mode)', async () => {
      const rec = new Recording(null, 0, 100, EMPTY_TIMELINE);
      await expect(rec.toVideo('/tmp/x.mp4')).rejects.toThrowError(/requires video capture/);
    });

    it('error message names both fix paths (Path Z + Path Y)', async () => {
      const rec = new Recording(null, 0, 100, EMPTY_TIMELINE);
      await expect(rec.toVideo('/tmp/x.mp4')).rejects.toThrowError(/human\.record/);
      await expect(
        new Recording(null, 0, 100, EMPTY_TIMELINE).toVideo('/tmp/x.mp4'),
      ).rejects.toThrowError(/@humanjs\/recorder/);
    });

    it('throws when no frames were captured', async () => {
      const capture = await makeCaptureResult(0);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      await expect(rec.toVideo('/tmp/x.mp4')).rejects.toThrowError(/No frames were captured/);
    });

    it('throws on an unsupported output extension', async () => {
      const capture = await makeCaptureResult(2);
      try {
        const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
        await expect(rec.toVideo('/tmp/x.gif')).rejects.toThrowError(/\.mp4 or \.webm/);
      } finally {
        await capture.cleanup();
      }
    });

    it('throws on a path with no extension', async () => {
      const capture = await makeCaptureResult(2);
      try {
        const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
        await expect(rec.toVideo('/tmp/x')).rejects.toThrowError(/Unsupported output extension/);
      } finally {
        await capture.cleanup();
      }
    });

    it('a failed toVideo attempt does NOT consume the frames (retryable)', async () => {
      const capture = await makeCaptureResult(2);
      try {
        const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
        // First call fails on bad extension — but the recording is not
        // finalized, so a subsequent call with a valid extension can still
        // see the frames.
        await expect(rec.toVideo('/tmp/x.json')).rejects.toThrowError(/Unsupported/);
        // (We don't actually invoke ffmpeg here — runFfmpeg would resolve
        // because the binary exists, but writing /tmp/x.mp4 isn't the
        // assertion we care about. The point is that the recording does
        // not throw "called after dispose".)
        await expect(rec.toVideo('/tmp/x.json')).rejects.toThrowError(/Unsupported/);
      } finally {
        await capture.cleanup();
      }
    });
  });

  describe('toGif error paths', () => {
    it('throws when capture is null (timeline-only mode)', async () => {
      const rec = new Recording(null, 0, 100, EMPTY_TIMELINE);
      await expect(rec.toGif('/tmp/x.gif')).rejects.toThrowError(/requires video capture/);
    });

    it('throws when no frames were captured', async () => {
      const capture = await makeCaptureResult(0);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      await expect(rec.toGif('/tmp/x.gif')).rejects.toThrowError(/No frames were captured/);
    });

    it('throws on an unsupported output extension', async () => {
      const capture = await makeCaptureResult(2);
      try {
        const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
        await expect(rec.toGif('/tmp/x.mp4')).rejects.toThrowError(/Use \.gif/);
      } finally {
        await capture.cleanup();
      }
    });
  });

  describe('dispose', () => {
    it('toVideo throws after dispose()', async () => {
      const capture = await makeCaptureResult(2);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      await rec.dispose();
      await expect(rec.toVideo('/tmp/x.mp4')).rejects.toThrowError(/after dispose/);
    });

    it('toGif throws after dispose()', async () => {
      const capture = await makeCaptureResult(2);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      await rec.dispose();
      await expect(rec.toGif('/tmp/x.gif')).rejects.toThrowError(/after dispose/);
    });

    it('toTimeline still works after dispose()', async () => {
      const capture = await makeCaptureResult(2);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      await rec.dispose();
      const dir = await mkdtemp(join(tmpdir(), 'humanjs-dispose-'));
      try {
        await rec.toTimeline(join(dir, 'session.json'));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('is idempotent — second call is a no-op', async () => {
      const capture = await makeCaptureResult(2);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      await rec.dispose();
      // Second dispose() must not throw, even though capture.cleanup() already ran.
      await rec.dispose();
    });

    it('no-op on a timeline-only Recording (no capture to clean up)', async () => {
      const rec = new Recording(null, 0, 100, EMPTY_TIMELINE);
      await rec.dispose();
    });

    it('Symbol.asyncDispose delegates to dispose()', async () => {
      const capture = await makeCaptureResult(2);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      await rec[Symbol.asyncDispose]();
      await expect(rec.toVideo('/tmp/x.mp4')).rejects.toThrowError(/after dispose/);
    });

    it('actually deletes the captured-frames temp directory', async () => {
      const { access } = await import('node:fs/promises');
      const capture = await makeCaptureResult(2);
      const rec = new Recording(capture, 0, 100, EMPTY_TIMELINE);
      // Dir exists before dispose
      await expect(access(capture.dir)).resolves.toBeUndefined();
      await rec.dispose();
      // Dir is gone after dispose
      await expect(access(capture.dir)).rejects.toThrow();
    });
  });

  describe('timeline', () => {
    const sample: RecordingTimelineSource = {
      personality: 'distracted',
      seed: 'demo-1',
      speed: 'human',
      events: [
        { type: 'click', params: { target: '#login' }, tMs: 12, durationMs: 720 },
        {
          type: 'type',
          params: { target: '#email', length: 18 },
          tMs: 752,
          durationMs: 3400,
        },
      ],
    };

    it('exposes the in-memory timeline shape', () => {
      const rec = new Recording(null, 2000, 7240, sample);

      expect(rec.timeline).toEqual({
        version: 1,
        personality: 'distracted',
        seed: 'demo-1',
        speed: 'human',
        durationMs: 5240,
        events: sample.events,
      });
    });

    it('writes a JSON file matching the in-memory timeline', async () => {
      const { readFile } = await import('node:fs/promises');
      const rec = new Recording(null, 2000, 7240, sample);

      const dir = await mkdtemp(join(tmpdir(), 'humanjs-toTimeline-'));
      const outputPath = join(dir, 'session.json');
      try {
        const returned = await rec.toTimeline(outputPath);
        expect(returned).toBe(outputPath);

        const text = await readFile(outputPath, 'utf8');
        expect(JSON.parse(text)).toEqual(rec.timeline);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });

    it('is safe to call multiple times', async () => {
      const rec = new Recording(null, 2000, 7240, sample);

      const dir = await mkdtemp(join(tmpdir(), 'humanjs-toTimeline-'));
      try {
        await rec.toTimeline(join(dir, 'a.json'));
        await rec.toTimeline(join(dir, 'b.json'));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });
});
