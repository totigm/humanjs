import type { Page } from 'playwright';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCapture } from './capture';

/**
 * A page whose screenshot behaviour is scripted per call, so the loop's
 * failure handling can be driven deterministically.
 */
function makePage(behaviour: {
  screenshot: (call: number) => Promise<Buffer>;
  isClosed?: () => boolean;
}): { page: Page; calls: () => number } {
  let call = 0;
  const page = {
    screenshot: () => {
      const n = call++;
      return behaviour.screenshot(n);
    },
    isClosed: behaviour.isClosed ?? ((): boolean => false),
  } as unknown as Page;
  return { page, calls: () => call };
}

const frame = (): Promise<Buffer> => Promise.resolve(Buffer.from('x'));
const boom = (): Promise<Buffer> => Promise.reject(new Error('Unable to capture screenshot'));

/** Waits for real time to pass so the capture loop can tick. */
const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('startCapture failure handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps recording after a transient screenshot failure', async () => {
    // One bad frame in the middle of a healthy run. Losing the whole take
    // over it is the regression this guards.
    const { page } = makePage({
      screenshot: (n) => (n === 1 ? boom() : frame()),
    });
    const session = await startCapture(page, { fps: 40 });
    await tick(300);
    const result = await session.stop();

    expect(result.frames.length).toBeGreaterThan(1);
  });

  it('reports the dropped frame once rather than at the frame rate', async () => {
    const { page } = makePage({ screenshot: (n) => (n === 1 ? boom() : frame()) });
    const session = await startCapture(page, { fps: 40 });
    await tick(300);
    await session.stop();

    const dropped = vi
      .mocked(console.warn)
      .mock.calls.filter(([msg]) => String(msg).includes('dropping frame'));
    expect(dropped).toHaveLength(1);
  });

  it('stops immediately once the page is closed, without warning', async () => {
    let closed = false;
    const { page } = makePage({
      screenshot: (n) => {
        if (n >= 2) {
          closed = true;
          return boom();
        }
        return frame();
      },
      isClosed: () => closed,
    });
    const session = await startCapture(page, { fps: 40 });
    await tick(300);
    const result = await session.stop();

    expect(result.frames.length).toBeGreaterThan(0);
    // A closed page is an expected end, not a fault worth reporting.
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('gives up after a persistent run of failures instead of spinning forever', async () => {
    const { page, calls } = makePage({ screenshot: () => boom() });
    const session = await startCapture(page, { fps: 60 });
    await tick(600);
    await session.stop();

    // Bounded by the consecutive-failure cap, not by how long we waited.
    expect(calls()).toBeLessThanOrEqual(12);
    expect(
      vi
        .mocked(console.warn)
        .mock.calls.some(([msg]) => String(msg).includes('consecutive screenshot failures')),
    ).toBe(true);
  });

  it('resets the failure count on success, so scattered misses never accumulate', async () => {
    // Fails every other frame: 20+ failures overall, never 10 in a row.
    const { page } = makePage({ screenshot: (n) => (n % 2 === 1 ? boom() : frame()) });
    const session = await startCapture(page, { fps: 60 });
    await tick(600);
    const result = await session.stop();

    expect(result.frames.length).toBeGreaterThan(5);
    expect(
      vi
        .mocked(console.warn)
        .mock.calls.some(([msg]) => String(msg).includes('consecutive screenshot failures')),
    ).toBe(false);
  });
});
