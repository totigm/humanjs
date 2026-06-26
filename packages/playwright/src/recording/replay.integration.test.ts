import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TimelineEvent } from './index';
import { replayTimeline } from './replay';

/**
 * Real-browser integration tests for `replayTimeline`. Run in `instant` speed
 * with the cursor off so they're fast and headless. They exercise the full
 * event → humanized-call mapping, the assert evaluation, stop-at-first-failure,
 * and abort.
 */

const PAGE = `<!doctype html><body>
  <button id="btn" onclick="document.getElementById('out').textContent = 'clicked'">Go</button>
  <input id="name" />
  <span id="out">idle</span>
</body>`;

const event = (
  type: string,
  params: Record<string, unknown>,
  inputValue?: string,
): TimelineEvent => ({
  type,
  params,
  tMs: 0,
  durationMs: 0,
  ...(inputValue === undefined ? {} : { inputValue }),
});

describe('replayTimeline (integration)', () => {
  let browser: Awaited<ReturnType<typeof chromium.launch>>;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const freshPage = async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(2500); // keep failing-selector waits short
    await page.setContent(PAGE);
    return page;
  };

  it('replays a clean timeline and reports pass per step', async () => {
    const page = await freshPage();
    const updates: string[] = [];
    const result = await replayTimeline(
      page,
      [
        event('click', { target: '#btn' }),
        event('type', { target: '#name' }, 'Ada'),
        event('assert', { kind: 'visible', target: '#name' }),
        event('assert', { kind: 'text', target: '#out', value: 'clicked' }),
      ],
      { speed: 'instant', cursor: false, onStep: (u) => updates.push(`${u.index}:${u.status}`) },
    );

    expect(result.status).toBe('pass');
    expect(result.steps.map((s) => s.status)).toEqual(['pass', 'pass', 'pass', 'pass']);
    expect(updates).toContain('0:running');
    expect(updates).toContain('3:pass');
    expect(await page.locator('#name').inputValue()).toBe('Ada');
  });

  it('stops at the first failing step and leaves the rest unrun', async () => {
    const page = await freshPage();
    const result = await replayTimeline(
      page,
      [
        event('click', { target: '#btn' }),
        event('click', { target: '#missing' }),
        event('type', { target: '#name' }, 'x'),
      ],
      { speed: 'instant', cursor: false },
    );

    expect(result.status).toBe('fail');
    expect(result.failedIndex).toBe(1);
    expect(result.steps).toHaveLength(2); // the third step never ran
    expect(result.steps.at(1)?.status).toBe('fail');
    expect(await page.locator('#name').inputValue()).toBe('');
  });

  it('fails on an assertion mismatch with a descriptive error', async () => {
    const page = await freshPage();
    const result = await replayTimeline(
      page,
      [event('assert', { kind: 'text', target: '#out', value: 'clicked' })],
      {
        speed: 'instant',
        cursor: false,
      },
    );

    expect(result.status).toBe('fail');
    expect(result.failedIndex).toBe(0);
    expect(result.steps.at(0)?.error).toContain('expected text');
  });

  it('rejects with an AbortError when the signal is already aborted', async () => {
    const page = await freshPage();
    const controller = new AbortController();
    controller.abort();
    await expect(
      replayTimeline(page, [event('click', { target: '#btn' })], {
        signal: controller.signal,
        cursor: false,
      }),
    ).rejects.toThrow('Replay aborted');
  });
});
