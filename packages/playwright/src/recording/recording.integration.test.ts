import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHuman } from '../index';

/**
 * Real-browser integration tests for `human.record()`. The unit tests in
 * `recording.test.ts` mock the capture pipeline; these exercise the
 * full path: launch chromium → poll page.screenshot() → write frames
 * to disk → assemble via ffmpeg → produce a valid mp4.
 *
 * Slow (~5-10s per test); separated from the unit tests so the fast
 * suite stays fast.
 */

describe('human.record (integration)', () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('captures a video and produces a non-empty mp4', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    await page.setContent(
      '<html><body style="background:#222"><button id="b" style="margin:200px">Click</button></body></html>',
    );
    const human = await createHuman(page);

    // Short recording (~1s of capture) with the lowest-quality preset to
    // keep the test fast. We're testing the pipeline works end-to-end,
    // not the visual quality.
    const rec = await human.record({ quality: 'fast' }, async () => {
      await human.click('#b');
    });

    expect(rec.hasVideo).toBe(true);
    expect(rec.timeline.events.length).toBeGreaterThanOrEqual(1);

    const outputPath = join(tmpdir(), `humanjs-rec-int-${Date.now()}.mp4`);
    try {
      await rec.toVideo(outputPath, { quality: 'fast' });

      const info = await stat(outputPath);
      // An mp4 with at least one captured frame is going to be in the
      // hundreds of bytes at minimum — ffmpeg's box headers alone exceed
      // 200 bytes. A 0-byte file would mean ffmpeg silently bailed.
      expect(info.size).toBeGreaterThan(500);
    } finally {
      await unlink(outputPath).catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });

  it('throws on toVideo when recording was started with { video: false }', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const human = await createHuman(page);

    const rec = await human.record({ video: false }, async () => {
      // No actions — just exercising the timeline-only path.
    });

    expect(rec.hasVideo).toBe(false);
    await expect(rec.toVideo('/tmp/should-not-exist.mp4')).rejects.toThrowError(
      /requires video capture/,
    );
    await context.close();
  });

  it('throws when human.record() is called twice on the same session', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const human = await createHuman(page);

    await human.record({ video: false }, async () => {
      // empty
    });

    await expect(
      human.record({ video: false }, async () => {
        // empty
      }),
    ).rejects.toThrowError(/can only be called once/);

    await context.close();
  });
});
