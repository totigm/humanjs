/// <reference lib="dom" />

import { readFile, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { record } from './index';

/**
 * Integration tests for the one-call `record()` helper. The function is a
 * thin wrapper around `human.record()` + lifecycle management; mocking it
 * would mostly test the mocks, so these run a real headless browser.
 *
 * Slow (~5-10s per test); accepted cost for testing the convenience API
 * that's the package's whole reason to exist.
 */

describe('record (integration)', () => {
  it('runs the callback and returns a Recording', async () => {
    const rec = await record({ headless: true, quality: 'fast' }, async (human, page) => {
      await page.setContent(
        '<html><body style="background:#222"><button id="b">Click</button></body></html>',
      );
      await human.click('#b');
    });

    // No `output` → no video capture
    expect(rec.hasVideo).toBe(false);
    // Click action made it into the timeline
    expect(rec.timeline.events.some((e) => e.type === 'click')).toBe(true);
  });

  it('writes the mp4 when output is provided', async () => {
    const outputPath = join(tmpdir(), `humanjs-recorder-int-${Date.now()}.mp4`);
    try {
      const rec = await record(
        { output: outputPath, headless: true, quality: 'fast' },
        async (human, page) => {
          await page.setContent(
            '<html><body><button id="b" style="margin:200px">x</button></body></html>',
          );
          await human.click('#b');
        },
      );

      expect(rec.hasVideo).toBe(true);
      const info = await stat(outputPath);
      expect(info.size).toBeGreaterThan(500);
    } finally {
      await unlink(outputPath).catch(() => undefined);
    }
  });

  it('dispatches to toGif when output ends in .gif', async () => {
    const outputPath = join(tmpdir(), `humanjs-recorder-int-${Date.now()}.gif`);
    try {
      const rec = await record(
        { output: outputPath, headless: true, quality: 'fast' },
        async (human, page) => {
          await page.setContent(
            '<html><body><button id="b" style="margin:200px">x</button></body></html>',
          );
          await human.click('#b');
        },
      );

      expect(rec.hasVideo).toBe(true);
      const info = await stat(outputPath);
      expect(info.size).toBeGreaterThan(500);

      // Magic-byte check confirms the dispatcher actually routed to toGif,
      // not toVideo with a misleading extension.
      const header = await readFile(outputPath);
      expect(header.subarray(0, 3).toString('ascii')).toBe('GIF');
      expect(header.subarray(3, 6).toString('ascii')).toMatch(/^8[79]a$/);
    } finally {
      await unlink(outputPath).catch(() => undefined);
    }
  });

  it('accepts a callback as the only argument (overload 1)', async () => {
    const rec = await record(async (human, page) => {
      await page.setContent('<html><body><button id="b">x</button></body></html>');
      await human.click('#b');
    });

    expect(rec.hasVideo).toBe(false);
    expect(rec.timeline.events.length).toBeGreaterThan(0);
  });

  it('auto-installs the cursor overlay by default', async () => {
    const rec = await record({ headless: true }, async (_human, page) => {
      await page.setContent('<html><body><div id="x">x</div></body></html>');
      // Wait a tick for the addInitScript + DOMContentLoaded re-inject
      // to land before we probe the DOM.
      await page.waitForTimeout(50);
      const hasCursor = await page.evaluate(
        () => document.querySelector('[data-humanjs-cursor]') !== null,
      );
      expect(hasCursor).toBe(true);
    });
    expect(rec.hasVideo).toBe(false);
  });

  it('skips the cursor overlay when cursor: false', async () => {
    await record({ headless: true, cursor: false }, async (_human, page) => {
      await page.setContent('<html><body><div id="x">x</div></body></html>');
      await page.waitForTimeout(50);
      const hasCursor = await page.evaluate(
        () => document.querySelector('[data-humanjs-cursor]') !== null,
      );
      expect(hasCursor).toBe(false);
    });
  });
});
