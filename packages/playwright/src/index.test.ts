import type { HumanPlugin } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createHuman } from './index';

interface MockLocator {
  focus: ReturnType<typeof vi.fn>;
  pressSequentially: ReturnType<typeof vi.fn>;
  innerText?: ReturnType<typeof vi.fn>;
  evaluate?: ReturnType<typeof vi.fn>;
  scrollIntoViewIfNeeded?: ReturnType<typeof vi.fn>;
  boundingBox?: ReturnType<typeof vi.fn>;
}

interface MockPage {
  page: Page;
  locator: MockLocator;
  pressedKeys: string[];
}

/**
 * Mocks the minimum surface of `Page` we exercise in tests:
 * `goto`, `locator()`, and `keyboard.press`. `locator()` always returns the
 * same `MockLocator` instance so assertions can read its call list directly.
 */
function makeMockPage(overrides: Partial<Page> = {}): Page {
  const locator: MockLocator = {
    focus: vi.fn().mockResolvedValue(undefined),
    pressSequentially: vi.fn().mockResolvedValue(undefined),
  };
  return {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn().mockReturnValue(locator as unknown as Locator),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  } as unknown as Page;
}

/**
 * Same as {@link makeMockPage} but also returns the locator + a list of keys
 * passed to `keyboard.press`, so tests can assert exact keystroke sequences.
 */
function makeKeyboardMockPage(): MockPage {
  const locator: MockLocator = {
    focus: vi.fn().mockResolvedValue(undefined),
    pressSequentially: vi.fn().mockResolvedValue(undefined),
  };
  const pressedKeys: string[] = [];
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn().mockReturnValue(locator as unknown as Locator),
    keyboard: {
      press: vi.fn().mockImplementation((key: string) => {
        pressedKeys.push(key);
        return Promise.resolve();
      }),
    },
  } as unknown as Page;
  return { page, locator, pressedKeys };
}

/**
 * Page mock for reading tests: locator returns `innerText` + `evaluate` so
 * the adapter can extract text and auto-detect the kind from the tag name.
 */
function makeReadingMockPage(
  options: {
    text?: string;
    tagName?: string;
    boundingBox?: { x: number; y: number; width: number; height: number } | null;
  } = {},
): {
  page: Page;
  locator: MockLocator;
  mouseMoves: Array<{ x: number; y: number }>;
} {
  const locator: MockLocator = {
    focus: vi.fn().mockResolvedValue(undefined),
    pressSequentially: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue(options.text ?? ''),
    evaluate: vi.fn().mockResolvedValue(options.tagName ?? 'div'),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    boundingBox: vi
      .fn()
      .mockResolvedValue(
        options.boundingBox === undefined
          ? { x: 100, y: 200, width: 600, height: 200 }
          : options.boundingBox,
      ),
  };
  const mouseMoves: Array<{ x: number; y: number }> = [];
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn().mockReturnValue(locator as unknown as Locator),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    mouse: {
      move: vi.fn().mockImplementation((x: number, y: number) => {
        mouseMoves.push({ x, y });
        return Promise.resolve();
      }),
    },
  } as unknown as Page;
  return { page, locator, mouseMoves };
}

describe('createHuman', () => {
  describe('options', () => {
    it('defaults to the careful personality', async () => {
      const human = await createHuman(makeMockPage());
      expect(human.personality.name).toBe('careful');
    });

    it('resolves a preset name', async () => {
      const human = await createHuman(makeMockPage(), { personality: 'fast' });
      expect(human.personality.name).toBe('fast');
    });

    it('resolves a preset extension', async () => {
      const human = await createHuman(makeMockPage(), {
        personality: { extends: 'careful', name: 'super-careful' },
      });
      expect(human.personality.name).toBe('super-careful');
    });

    it("defaults speed to 'human'", async () => {
      const human = await createHuman(makeMockPage());
      expect(human.speed).toBe('human');
    });

    it('respects the speed override', async () => {
      const human = await createHuman(makeMockPage(), { speed: 'instant' });
      expect(human.speed).toBe('instant');
    });
  });

  describe('goto', () => {
    it('delegates to page.goto', async () => {
      const page = makeMockPage();
      const human = await createHuman(page);
      await human.goto('https://example.com');
      expect(page.goto).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('plugin lifecycle', () => {
    it('calls install once with personality and rng in context', async () => {
      const install = vi.fn();
      await createHuman(makeMockPage(), {
        plugins: [{ name: 'p', install }],
      });
      expect(install).toHaveBeenCalledTimes(1);
      const ctx = install.mock.calls[0]?.[0];
      expect(ctx.personality.name).toBe('careful');
      expect(typeof ctx.rng.next).toBe('function');
    });

    it('calls beforeAction and afterAction around each action', async () => {
      const calls: string[] = [];
      const plugin: HumanPlugin = {
        name: 'recorder',
        beforeAction: (action) => {
          calls.push(`before:${action.type}`);
        },
        afterAction: (action) => {
          calls.push(`after:${action.type}`);
        },
      };
      const human = await createHuman(makeMockPage(), { plugins: [plugin] });
      await human.goto('/');
      expect(calls).toEqual(['before:goto', 'after:goto']);
    });

    it('passes action params to beforeAction', async () => {
      const beforeAction = vi.fn();
      const human = await createHuman(makeMockPage(), {
        plugins: [{ name: 'p', beforeAction }],
      });
      await human.goto('https://example.com');
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'goto',
        params: { url: 'https://example.com' },
      });
    });

    it('passes a non-negative durationMs to afterAction', async () => {
      const afterAction = vi.fn();
      const human = await createHuman(makeMockPage(), {
        plugins: [{ name: 'p', afterAction }],
      });
      await human.goto('/');
      const result = afterAction.mock.calls[0]?.[1];
      expect(result.type).toBe('goto');
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('calls plugins in registration order', async () => {
      const order: string[] = [];
      const human = await createHuman(makeMockPage(), {
        plugins: [
          {
            name: 'one',
            beforeAction: () => {
              order.push('one');
            },
          },
          {
            name: 'two',
            beforeAction: () => {
              order.push('two');
            },
          },
        ],
      });
      await human.goto('/');
      expect(order).toEqual(['one', 'two']);
    });

    it('awaits async hooks before continuing', async () => {
      let resolved = false;
      const human = await createHuman(makeMockPage(), {
        plugins: [
          {
            name: 'async',
            beforeAction: async () => {
              await new Promise((r) => setTimeout(r, 5));
              resolved = true;
            },
          },
        ],
      });
      await human.goto('/');
      expect(resolved).toBe(true);
    });

    it('notifies onError and re-throws when the underlying action fails', async () => {
      const error = new Error('navigation failed');
      const page = makeMockPage({
        goto: vi.fn().mockRejectedValue(error),
      } as unknown as Page);
      const onError = vi.fn();
      const human = await createHuman(page, {
        plugins: [{ name: 'p', onError }],
      });
      await expect(human.goto('/')).rejects.toThrow('navigation failed');
      expect(onError).toHaveBeenCalledWith({ type: 'goto', params: { url: '/' } }, error);
    });

    it('skips hooks plugins do not define', async () => {
      const beforeAction = vi.fn();
      const human = await createHuman(makeMockPage(), {
        plugins: [{ name: 'silent' }, { name: 'noisy', beforeAction }],
      });
      await human.goto('/');
      expect(beforeAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('type', () => {
    it('focuses the target before typing in human speed', async () => {
      const { page, locator } = makeKeyboardMockPage();
      const human = await createHuman(page, { seed: 'type-1' });
      await human.type('input[name="email"]', 'hi');
      expect(page.locator).toHaveBeenCalledWith('input[name="email"]');
      expect(locator.focus).toHaveBeenCalledTimes(1);
    });

    it('presses one key per character in order (no-typo personality)', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      // typoProbability: 0 + thinkPauseProbability: 0 → deterministic keystroke sequence.
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 0,
            typoCorrectionProbability: 0,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        seed: 'type-2',
      });
      await human.type('input', 'abc');
      expect(pressedKeys).toEqual(['a', 'b', 'c']);
    });

    it('maps newline to Enter and tab to Tab', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 0,
            typoCorrectionProbability: 0,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        seed: 'type-keys',
      });
      await human.type('input', 'a\nb\tc');
      expect(pressedKeys).toEqual(['a', 'Enter', 'b', 'Tab', 'c']);
    });

    it('normalizes \\r and \\r\\n line endings to Enter', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 0,
            typoCorrectionProbability: 0,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        seed: 'type-cr',
      });
      await human.type('input', 'a\rb\r\nc');
      expect(pressedKeys).toEqual(['a', 'Enter', 'b', 'Enter', 'c']);
    });

    it('falls back to keyboard.insertText for non-ASCII characters', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      const inserted: string[] = [];
      (page.keyboard as { insertText: (text: string) => Promise<void> }).insertText = vi
        .fn()
        .mockImplementation((text: string) => {
          inserted.push(text);
          return Promise.resolve();
        });
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 0,
            typoCorrectionProbability: 0,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        seed: 'type-unicode',
      });
      await human.type('input', 'café');
      // ASCII chars go through press; non-ASCII (é) goes through insertText.
      expect(pressedKeys).toEqual(['c', 'a', 'f']);
      expect(inserted).toEqual(['é']);
    });

    it('produces the same keystroke sequence for the same seed (typing determinism)', async () => {
      const settings = {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 0.5,
            typoCorrectionProbability: 0.8,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        seed: 'type-determinism',
      } as const;
      const run1 = makeKeyboardMockPage();
      const human1 = await createHuman(run1.page, settings);
      await human1.type('input', 'hello world');

      const run2 = makeKeyboardMockPage();
      const human2 = await createHuman(run2.page, settings);
      await human2.type('input', 'hello world');

      expect(run1.pressedKeys).toEqual(run2.pressedKeys);
    });

    it('injects typos and recovers with Backspace when correction probability is 1', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      // Force every letter into a typo, and force every typo to be corrected.
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 1,
            typoCorrectionProbability: 1,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        seed: 'type-typos',
      });
      await human.type('input', 'a');
      // Expected sequence: wrongKey, Backspace, a
      expect(pressedKeys).toHaveLength(3);
      expect(pressedKeys[0]).not.toBe('a');
      expect(pressedKeys[1]).toBe('Backspace');
      expect(pressedKeys[2]).toBe('a');
    });

    it('leaves typos in place when correction probability is 0', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 1,
            typoCorrectionProbability: 0,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        seed: 'type-uncorrected',
      });
      await human.type('input', 'a');
      expect(pressedKeys).toHaveLength(1);
      expect(pressedKeys[0]).not.toBe('a');
      expect(pressedKeys).not.toContain('Backspace');
    });

    it('handles an empty value as a no-op without focusing', async () => {
      const { page, locator, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.type('input', '');
      expect(locator.focus).not.toHaveBeenCalled();
      expect(pressedKeys).toEqual([]);
    });

    it("uses pressSequentially with delay 0 in 'instant' mode", async () => {
      const { page, locator, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.type('input', 'abc');
      expect(locator.pressSequentially).toHaveBeenCalledWith('abc', { delay: 0 });
      // Per-key press should never be invoked in instant mode.
      expect(pressedKeys).toEqual([]);
      expect(locator.focus).not.toHaveBeenCalled();
    });

    it("emits a 'type' action with target description and length to plugins", async () => {
      const beforeAction = vi.fn();
      const afterAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 0,
            typoCorrectionProbability: 0,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        plugins: [{ name: 'p', beforeAction, afterAction }],
      });
      await human.type('input', 'hello');
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'type',
        params: { target: 'input', length: 5 },
      });
      const result = afterAction.mock.calls[0]?.[1];
      expect(result.type).toBe('type');
      expect(typeof result.durationMs).toBe('number');
    });

    it('does NOT echo the typed value into action params (privacy)', async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          typing: {
            baseDelayMs: 0,
            delayJitter: 0,
            typoProbability: 0,
            typoCorrectionProbability: 0,
            thinkPauseProbability: 0,
            thinkPauseMeanMs: 0,
          },
        },
        plugins: [{ name: 'p', beforeAction }],
      });
      await human.type('input', 'sup3r-secret');
      const action = beforeAction.mock.calls[0]?.[0];
      expect(action.params).not.toHaveProperty('value');
      expect(JSON.stringify(action.params)).not.toContain('sup3r-secret');
    });
  });

  describe('read', () => {
    it('extracts innerText from a selector and counts words', async () => {
      const { page, locator } = makeReadingMockPage({
        text: 'one two three four',
        tagName: 'div',
      });
      const beforeAction = vi.fn();
      const human = await createHuman(page, {
        // speed: 'instant' so the test doesn't actually sleep for the dwell
        speed: 'instant',
        plugins: [{ name: 'p', beforeAction }],
      });
      await human.read('.banner');
      expect(page.locator).toHaveBeenCalledWith('.banner');
      expect(locator.innerText).toHaveBeenCalledTimes(1);
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'read',
        params: { target: '.banner', kind: undefined },
      });
    });

    it('reads a Locator directly without going through page.locator()', async () => {
      const { page, locator } = makeReadingMockPage({ text: 'hello world' });
      const human = await createHuman(page, { speed: 'instant' });
      await human.read(locator as unknown as Locator);
      // We passed the Locator directly — page.locator should not be called.
      expect(page.locator).not.toHaveBeenCalled();
      expect(locator.innerText).toHaveBeenCalledTimes(1);
    });

    it('counts words from `{ text }` without touching the DOM', async () => {
      const { page, locator } = makeReadingMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.read({ text: 'four words right here' });
      expect(page.locator).not.toHaveBeenCalled();
      expect(locator.innerText).not.toHaveBeenCalled();
    });

    it('uses `{ words }` as a pre-counted value without touching the DOM', async () => {
      const { page, locator } = makeReadingMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.read({ words: 30 });
      expect(page.locator).not.toHaveBeenCalled();
      expect(locator.innerText).not.toHaveBeenCalled();
    });

    it('returns a ReadResult with words, durationMs, and final kind', async () => {
      const { page } = makeReadingMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.read({ words: 42, text: 'ignored when words present' });
      expect(result).toBeDefined();
      expect(result.words).toBe(42);
      expect(result.kind).toBe('prose');
      expect(typeof result.durationMs).toBe('number');
      // `speed: 'instant'` collapses dwell to 0 ms.
      expect(result.durationMs).toBe(0);
    });

    it('returns the auto-detected kind in the ReadResult when caller did not specify', async () => {
      const { page } = makeReadingMockPage({ text: 'const x = 1;', tagName: 'pre' });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.read('.snippet');
      expect(result.kind).toBe('code');
    });

    it('auto-detects the kind from the element tag when caller did not specify', async () => {
      const { page, locator } = makeReadingMockPage({ text: 'const x = 1;', tagName: 'pre' });
      const human = await createHuman(page, { speed: 'instant' });
      await human.read('.snippet');
      // Auto-detect runs the tag inspection (evaluate). The resolved 'code'
      // kind flows into the dwell calculation downstream.
      expect(locator.evaluate).toHaveBeenCalledTimes(1);
    });

    it('skips auto-detection when caller passes an explicit kind', async () => {
      const { page, locator } = makeReadingMockPage({ text: 'const x = 1;', tagName: 'pre' });
      const beforeAction = vi.fn();
      const human = await createHuman(page, {
        speed: 'instant',
        plugins: [{ name: 'p', beforeAction }],
      });
      await human.read('.snippet', { kind: 'scan' });
      // No tag inspection needed — the caller's kind wins.
      expect(locator.evaluate).not.toHaveBeenCalled();
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'read',
        params: { target: '.snippet', kind: 'scan' },
      });
    });

    it('scrolls into view when requested', async () => {
      const { page, locator } = makeReadingMockPage({ text: 'a b c' });
      const human = await createHuman(page, { speed: 'instant' });
      await human.read('.modal-body', { scrollIntoView: true });
      expect(locator.scrollIntoViewIfNeeded).toHaveBeenCalledTimes(1);
    });

    it('does not scroll into view by default', async () => {
      const { page, locator } = makeReadingMockPage({ text: 'a b c' });
      const human = await createHuman(page, { speed: 'instant' });
      await human.read('.banner');
      expect(locator.scrollIntoViewIfNeeded).not.toHaveBeenCalled();
    });

    it('does NOT echo literal text content into action params (privacy)', async () => {
      const beforeAction = vi.fn();
      const human = await createHuman(makeReadingMockPage().page, {
        speed: 'instant',
        plugins: [{ name: 'p', beforeAction }],
      });
      await human.read({ text: 'sup3r-secret-confirmation-token-xyz' });
      const action = beforeAction.mock.calls[0]?.[0];
      expect(JSON.stringify(action.params)).not.toContain('sup3r-secret');
      expect(JSON.stringify(action.params)).not.toContain('xyz');
    });

    it("emits a 'read' action with target description for plugins", async () => {
      const beforeAction = vi.fn();
      const afterAction = vi.fn();
      const human = await createHuman(makeReadingMockPage({ text: 'a b c' }).page, {
        speed: 'instant',
        plugins: [{ name: 'p', beforeAction, afterAction }],
      });
      await human.read('.welcome');
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'read',
        params: { target: '.welcome', kind: undefined },
      });
      const result = afterAction.mock.calls[0]?.[1];
      expect(result.type).toBe('read');
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns dwell of 0 in instant mode', async () => {
      const { page } = makeReadingMockPage({ text: 'a b c d e f g h i j' });
      // We can't directly observe the dwell from the public API (read returns void),
      // but in instant mode no sleep should happen. Smoke test: complete fast.
      const human = await createHuman(page, { speed: 'instant' });
      const startedAt = performance.now();
      await human.read('.long-paragraph');
      const elapsed = performance.now() - startedAt;
      expect(elapsed).toBeLessThan(50);
    });

    it('does NOT move the mouse during a default read (withMotion off)', async () => {
      const { page, mouseMoves } = makeReadingMockPage({ text: 'a b c d e' });
      const human = await createHuman(page, { speed: 'instant' });
      await human.read('.passage');
      expect(mouseMoves).toEqual([]);
    });

    it('walks the cursor through the bounding box when withMotion is enabled', async () => {
      const { page, locator, mouseMoves } = makeReadingMockPage({
        text: 'a b c d e f g h i j',
        boundingBox: { x: 100, y: 200, width: 600, height: 200 },
      });
      // Need a non-instant speed so durationMs > 0 and the motion branch fires.
      // wpmMultiplier keeps the dwell tiny so the test stays quick.
      const human = await createHuman(page, { speed: 'human', seed: 'motion-1' });
      await human.read('.passage', { withMotion: true, wpmMultiplier: 1000 });
      expect(locator.boundingBox).toHaveBeenCalledTimes(1);
      expect(mouseMoves.length).toBeGreaterThan(0);
      // Final move should land inside the box (the planner ends at the last
      // zigzag waypoint).
      const last = mouseMoves[mouseMoves.length - 1];
      expect(last).toBeDefined();
      if (last) {
        expect(last.x).toBeGreaterThanOrEqual(100);
        expect(last.x).toBeLessThanOrEqual(700);
        expect(last.y).toBeGreaterThanOrEqual(200);
        expect(last.y).toBeLessThanOrEqual(400);
      }
    });

    it('falls back to a plain sleep when the bounding box is null', async () => {
      const { page, mouseMoves } = makeReadingMockPage({
        text: 'a b c',
        boundingBox: null,
      });
      const human = await createHuman(page, { speed: 'human', seed: 'no-box' });
      // Should complete without throwing even though there's no box to scan.
      await human.read('.gone', { withMotion: true, wpmMultiplier: 1000 });
      expect(mouseMoves).toEqual([]);
    });

    it('updates the tracked cursor position to the scan endpoint', async () => {
      // Two reads in a row — the second's scan starts from where the first's
      // ended. Verifies the session's lastMousePosition gets updated.
      const { page, mouseMoves } = makeReadingMockPage({
        text: 'a b c d e f g',
        boundingBox: { x: 100, y: 200, width: 600, height: 200 },
      });
      const human = await createHuman(page, { speed: 'human', seed: 'motion-track' });
      await human.read('.first', { withMotion: true, wpmMultiplier: 1000 });
      const firstScanEnd = mouseMoves[mouseMoves.length - 1];
      const firstScanLen = mouseMoves.length;
      await human.read('.second', { withMotion: true, wpmMultiplier: 1000 });
      // The second scan's first move should be very close to the first scan's
      // final position (cursor didn't teleport between reads).
      const secondScanStart = mouseMoves[firstScanLen];
      expect(firstScanEnd).toBeDefined();
      expect(secondScanStart).toBeDefined();
      if (firstScanEnd && secondScanStart) {
        expect(Math.abs(secondScanStart.x - firstScanEnd.x)).toBeLessThan(40);
        expect(Math.abs(secondScanStart.y - firstScanEnd.y)).toBeLessThan(40);
      }
    });

    it('ignores withMotion when target is { text } (no bounding box available)', async () => {
      const { page, mouseMoves } = makeReadingMockPage();
      const human = await createHuman(page, { speed: 'human', seed: 'no-loc' });
      // No selector, no Locator → no box → motion is silently a no-op.
      await human.read({ text: 'a b c d' }, { withMotion: true, wpmMultiplier: 1000 });
      expect(mouseMoves).toEqual([]);
    });
  });

  describe('determinism', () => {
    it('produces an identical rng for the same seed', async () => {
      let first = 0;
      let second = 0;
      await createHuman(makeMockPage(), {
        seed: 'reproducible',
        plugins: [
          {
            name: 'p',
            install: (ctx) => {
              first = ctx.rng.next();
            },
          },
        ],
      });
      await createHuman(makeMockPage(), {
        seed: 'reproducible',
        plugins: [
          {
            name: 'p',
            install: (ctx) => {
              second = ctx.rng.next();
            },
          },
        ],
      });
      expect(first).toBe(second);
    });
  });
});
