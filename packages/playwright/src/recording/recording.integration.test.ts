import { spawn } from 'node:child_process';
import { access, readFile, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHuman } from '../index';

const HERE = dirname(fileURLToPath(import.meta.url));

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

  it('produces a valid GIF via toGif()', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    await page.setContent(
      '<html><body style="background:#222"><button id="b" style="margin:200px">Click</button></body></html>',
    );
    const human = await createHuman(page);

    const rec = await human.record({ quality: 'fast' }, async () => {
      await human.click('#b');
    });

    const outputPath = join(tmpdir(), `humanjs-gif-int-${Date.now()}.gif`);
    try {
      await rec.toGif(outputPath, { fps: 10, width: 320 });

      const info = await stat(outputPath);
      // A real GIF with at least one frame at 320px is at least a couple
      // kilobytes — header + global color table + image data.
      expect(info.size).toBeGreaterThan(500);

      // Magic bytes — must start with "GIF87a" or "GIF89a". Cheap end-to-end
      // sanity check that ffmpeg actually produced a GIF and not garbage.
      const header = await readFile(outputPath);
      expect(header.subarray(0, 3).toString('ascii')).toBe('GIF');
      expect(header.subarray(3, 6).toString('ascii')).toMatch(/^8[79]a$/);
    } finally {
      await unlink(outputPath).catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });

  it('toVideo() and toGif() can both run on the same Recording', async () => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await context.newPage();
    await page.setContent(
      '<html><body style="background:#222"><button id="b" style="margin:200px">x</button></body></html>',
    );
    const human = await createHuman(page);

    const rec = await human.record({ quality: 'fast' }, async () => {
      await human.click('#b');
    });

    const stamp = Date.now();
    const videoPath = join(tmpdir(), `humanjs-multi-int-${stamp}.mp4`);
    const gifPath = join(tmpdir(), `humanjs-multi-int-${stamp}.gif`);
    try {
      // The repeatable / interleavable contract — both exporters consume the
      // same captured frames without finalizing them. Order is deliberately
      // non-trivial: gif first, then mp4, to prove cleanup didn't run after
      // the first export.
      await rec.toGif(gifPath, { fps: 10, width: 320 });
      await rec.toVideo(videoPath, { quality: 'fast' });

      expect((await stat(videoPath)).size).toBeGreaterThan(500);
      expect((await stat(gifPath)).size).toBeGreaterThan(500);
    } finally {
      await unlink(videoPath).catch(() => undefined);
      await unlink(gifPath).catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });

  it('captures typed/pasted values by default and masks password fields', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(
      '<html><body>' +
        '<input id="email" type="email" />' +
        '<input id="pw" type="password" />' +
        '<textarea id="notes"></textarea>' +
        '</body></html>',
    );
    const human = await createHuman(page, { speed: 'instant' });

    const rec = await human.record({ video: false }, async () => {
      await human.type('#email', 'gonzalo@example.com');
      await human.paste('#pw', 'super-secret');
      await human.paste('#notes', 'just a note');
    });

    const byTarget = (t: string) => rec.timeline.events.find((e) => e.params.target === t);

    // Non-sensitive fields: real value captured.
    expect(byTarget('#email')?.inputValue).toBe('gonzalo@example.com');
    expect(byTarget('#notes')?.inputValue).toBe('just a note');
    // Password field: value masked (omitted) even though capture is on.
    expect(byTarget('#pw')?.inputValue).toBeUndefined();
    // length metadata is still present for all of them.
    expect(byTarget('#pw')?.params.length).toBe('super-secret'.length);

    // The captured value flows into generated code; the password does not.
    const { mkdtemp } = await import('node:fs/promises');
    const dir = await mkdtemp(join(tmpdir(), 'humanjs-codegen-'));
    const scriptPath = join(dir, 'session.ts');
    try {
      await rec.toHumanJS(scriptPath);
      const code = await readFile(scriptPath, 'utf8');
      expect(code).toContain("await human.type('#email', 'gonzalo@example.com');");
      expect(code).not.toContain('super-secret');
      expect(code).toContain("await human.paste('#pw', '');");
    } finally {
      await unlink(scriptPath).catch(() => undefined);
      await context.close().catch(() => undefined);
    }
  });

  it('records no input values when captureInputs is false', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent('<html><body><input id="email" /></body></html>');
    const human = await createHuman(page, { speed: 'instant' });

    const rec = await human.record({ video: false, captureInputs: false }, async () => {
      await human.type('#email', 'gonzalo@example.com');
    });

    const event = rec.timeline.events.find((e) => e.params.target === '#email');
    expect(event?.inputValue).toBeUndefined();
    expect(event?.params.length).toBe('gonzalo@example.com'.length);
    await context.close();
  });

  it('sweep-on-exit deletes an un-disposed capture dir when the process ends', async () => {
    // Spawn a child Node process that constructs a Recording with a real
    // capture dir and then exits WITHOUT calling dispose. The sweep handler
    // wired in the Recording constructor must remove the dir on exit.
    const subprocessPath = join(HERE, 'sweep-on-exit.subprocess.ts');
    const { stdout, code } = await runNodeSubprocess(subprocessPath);

    expect(code).toBe(0);
    const capturedDir = stdout.trim();
    expect(capturedDir.length).toBeGreaterThan(0);

    // After the child exits, the dir is gone — `access` throws ENOENT.
    await expect(access(capturedDir)).rejects.toThrow();
  });
});

/**
 * Spawns a Node subprocess running a `.ts` file via `--import tsx` (tsx is
 * already a dev dependency for the examples package). Returns the collected
 * stdout/stderr/exitCode once the child exits.
 */
function runNodeSubprocess(
  scriptPath: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}
