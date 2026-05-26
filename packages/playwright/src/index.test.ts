import type { HumanPlugin } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createHuman, type Shortcut } from './index';

interface MockLocator {
  focus: ReturnType<typeof vi.fn>;
  pressSequentially: ReturnType<typeof vi.fn>;
  innerText?: ReturnType<typeof vi.fn>;
  evaluate?: ReturnType<typeof vi.fn>;
  scrollIntoViewIfNeeded?: ReturnType<typeof vi.fn>;
  boundingBox?: ReturnType<typeof vi.fn>;
  click?: ReturnType<typeof vi.fn>;
}

/**
 * Page mock for scroll tests. Returns geometry (`{ current, viewport, total }`)
 * from a geometry-read evaluate, captures `window.scrollTo` positions in
 * `scrollToCalls`, and records `page.mouse.wheel` deltas separately by
 * axis (`wheelDeltas` for Y, `wheelDeltasX` for X) so horizontal-scroll
 * tests can assert on the right axis.
 *
 * Note: the evaluate-call discrimination relies on internal arg shapes
 * from the executor (`'pos' in arg` → scrollTo; otherwise → geometry).
 * If you rename `pos` in `executeScroll`, update this mock too — the
 * tests would otherwise silently stop tracking the calls they claim to.
 */
function makeScrollMockPage(
  options: {
    scrollY?: number;
    viewport?: number;
    docHeight?: number;
    elementY?: number;
    elementHeight?: number;
    elementBox?: { x: number; y: number; width: number; height: number } | null;
  } = {},
): {
  page: Page;
  locator: MockLocator;
  wheelDeltas: number[];
  wheelDeltasX: number[];
  scrollToCalls: number[];
} {
  const scrollY = options.scrollY ?? 0;
  const viewport = options.viewport ?? 800;
  const docHeight = options.docHeight ?? 5000;
  const defaultElementBox = {
    x: 0,
    y: options.elementY ?? 1500,
    width: 200,
    height: options.elementHeight ?? 100,
  };
  const locator: MockLocator = {
    focus: vi.fn().mockResolvedValue(undefined),
    pressSequentially: vi.fn().mockResolvedValue(undefined),
    boundingBox: vi
      .fn()
      .mockResolvedValue(options.elementBox === undefined ? defaultElementBox : options.elementBox),
  };
  const wheelDeltas: number[] = [];
  const wheelDeltasX: number[] = [];
  const scrollToCalls: number[] = [];
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn().mockReturnValue(locator as unknown as Locator),
    keyboard: { press: vi.fn().mockResolvedValue(undefined) },
    evaluate: vi.fn().mockImplementation((_fn: unknown, arg?: unknown) => {
      // Arg form → window.scrollTo(...) in the executor's instant path.
      // The executor passes `{ axis, pos }` so it can pick the right axis;
      // we only care about `pos` for the assertion.
      if (arg && typeof arg === 'object' && 'pos' in arg) {
        scrollToCalls.push((arg as { pos: number }).pos);
        return Promise.resolve(undefined);
      }
      // Single-arg form → page geometry read (axis as a string).
      return Promise.resolve({ current: scrollY, viewport, total: docHeight });
    }),
    mouse: {
      wheel: vi.fn().mockImplementation((dx: number, dy: number) => {
        wheelDeltas.push(dy);
        wheelDeltasX.push(dx);
        return Promise.resolve();
      }),
    },
  } as unknown as Page;
  return { page, locator, wheelDeltas, wheelDeltasX, scrollToCalls };
}

interface MockPage {
  page: Page;
  locator: MockLocator;
  pressedKeys: string[];
  insertedText: string[];
  mouseClicks: Array<{ x: number; y: number; button?: string }>;
  mouseButtonEvents: Array<'down' | 'up'>;
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
    // The implicit click in human.type() / human.paste() needs a bounding
    // box; hover/rightClick/drag use it too. 40×40 at (100, 100) is wide
    // enough that the Gaussian click-picker stays inside the rect.
    boundingBox: vi.fn().mockResolvedValue({ x: 100, y: 100, width: 40, height: 40 }),
    click: vi.fn().mockResolvedValue(undefined),
  };
  const pressedKeys: string[] = [];
  const insertedText: string[] = [];
  const mouseClicks: Array<{ x: number; y: number; button?: string }> = [];
  const mouseButtonEvents: Array<'down' | 'up'> = [];
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn().mockReturnValue(locator as unknown as Locator),
    keyboard: {
      press: vi.fn().mockImplementation((key: string) => {
        pressedKeys.push(key);
        return Promise.resolve();
      }),
      insertText: vi.fn().mockImplementation((text: string) => {
        insertedText.push(text);
        return Promise.resolve();
      }),
    },
    mouse: {
      move: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockImplementation((x: number, y: number, opts?: { button?: string }) => {
        mouseClicks.push({ x, y, button: opts?.button });
        return Promise.resolve();
      }),
      down: vi.fn().mockImplementation(() => {
        mouseButtonEvents.push('down');
        return Promise.resolve();
      }),
      up: vi.fn().mockImplementation(() => {
        mouseButtonEvents.push('up');
        return Promise.resolve();
      }),
    },
  } as unknown as Page;
  return { page, locator, pressedKeys, insertedText, mouseClicks, mouseButtonEvents };
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

  describe('sleep', () => {
    it('pauses for approximately the requested duration', async () => {
      const page = makeMockPage();
      const human = await createHuman(page);
      const startedAt = Date.now();
      await human.sleep(60);
      const elapsed = Date.now() - startedAt;
      // Wide tolerance — setTimeout can fire a few ms early on macOS and is
      // subject to event-loop scheduling jitter. We're verifying the method
      // exists and pauses, not measuring timer precision.
      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(500);
    });

    it("emits a 'sleep' action with ms param to plugins", async () => {
      const beforeAction = vi.fn();
      const afterAction = vi.fn();
      const human = await createHuman(makeMockPage(), {
        plugins: [{ name: 'p', beforeAction, afterAction }],
      });
      await human.sleep(20);
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'sleep',
        params: { ms: 20 },
      });
      const result = afterAction.mock.calls[0]?.[1];
      expect(result.type).toBe('sleep');
      expect(typeof result.durationMs).toBe('number');
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

    it('handles an empty value as a no-op (no click, no focus, no keys)', async () => {
      const { page, locator, pressedKeys, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.type('input', '');
      expect(locator.focus).not.toHaveBeenCalled();
      expect(pressedKeys).toEqual([]);
      // Empty value also skips the implicit click — no setup needed when
      // there's nothing to type.
      expect(mouseClicks).toEqual([]);
    });

    it('clicks the target before typing in human mode (mouse-led focus, not programmatic)', async () => {
      // A real user moves their cursor to the input and clicks it; they don't
      // teleport-focus a field. human.type() drives an implicit click before
      // delegating to the keyboard executor — same pattern as click's
      // built-in hover-before-click motion.
      const { page, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.type('input', 'abc');
      expect(mouseClicks).toHaveLength(1);
      // Click point is Gaussian-picked near the box center. Asserting the
      // click landed inside (or very near) the mocked box at (100, 100, 40, 40)
      // proves the click was driven by the bounding-box read, not by some
      // other code path that would have used the origin or current mouse pos.
      const click = mouseClicks[0] ?? { x: 0, y: 0 };
      expect(click.x).toBeGreaterThan(95);
      expect(click.x).toBeLessThan(145);
      expect(click.y).toBeGreaterThan(95);
      expect(click.y).toBeLessThan(145);
    });

    it('does NOT emit a separate click timeline event for the implicit click', async () => {
      // The click is a sub-step of the type action — same schema treatment as
      // click's hover motion (no 'hover' event). Plugin observers see exactly
      // one event per human.type() call, regardless of the mouse motion that
      // happened underneath.
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.type('input', 'abc');
      const types = beforeAction.mock.calls.map((c) => (c[0] as { type: string }).type);
      expect(types).toEqual(['type']);
    });

    it("uses pressSequentially with delay 0 in 'instant' mode", async () => {
      const { page, locator, pressedKeys, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.type('input', 'abc');
      expect(locator.pressSequentially).toHaveBeenCalledWith('abc', { delay: 0 });
      // Per-key press should never be invoked in instant mode.
      expect(pressedKeys).toEqual([]);
      expect(locator.focus).not.toHaveBeenCalled();
      // Instant mode also skips the implicit click — the whole point of
      // 'instant' is to bypass humanization for fast CI runs.
      expect(mouseClicks).toEqual([]);
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

  describe('paste', () => {
    it('inserts the full value via keyboard.insertText (no per-key timing)', async () => {
      const { page, insertedText, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.paste('input', 'long-pasted-value');
      expect(insertedText).toEqual(['long-pasted-value']);
      // Critical: paste must NOT use the per-key path. If pressedKeys had
      // entries, we'd be doing typing-rhythm work for a paste operation.
      expect(pressedKeys).toEqual([]);
    });

    it('clicks the target before pasting in human mode (same as type)', async () => {
      const { page, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.paste('input', 'abc');
      // The implicit click happens for the same reason type() does it: a
      // real user clicks the field before pasting.
      expect(mouseClicks).toHaveLength(1);
    });

    it('skips the implicit click in instant mode', async () => {
      const { page, mouseClicks, insertedText } = makeKeyboardMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.paste('input', 'abc');
      expect(mouseClicks).toEqual([]);
      // The value still lands — instant mode bypasses humanization, not the
      // primitive itself.
      expect(insertedText).toEqual(['abc']);
    });

    it('treats an empty value as a no-op (no click, no insertText, no focus)', async () => {
      const { page, locator, mouseClicks, insertedText } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.paste('input', '');
      expect(mouseClicks).toEqual([]);
      expect(insertedText).toEqual([]);
      expect(locator.focus).not.toHaveBeenCalled();
    });

    it('does NOT echo the pasted value into action params (privacy)', async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.paste('input', 'pasted-token-12345');
      const action = beforeAction.mock.calls[0]?.[0];
      expect(action.params).not.toHaveProperty('value');
      expect(JSON.stringify(action.params)).not.toContain('pasted-token-12345');
    });
  });

  describe('shortcut', () => {
    it('dispatches the resolved chord via page.keyboard.press', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      try {
        const { page, pressedKeys } = makeKeyboardMockPage();
        const human = await createHuman(page);
        await human.shortcut('Mod+S');
        expect(pressedKeys).toEqual(['Meta+S']);
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          configurable: true,
        });
      }
    });

    it('dispatches single-key shortcuts (no modifier)', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.shortcut('Enter');
      expect(pressedKeys).toEqual(['Enter']);
    });

    it("emits a 'shortcut' action with the original chord to plugins", async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.shortcut('Cmd+Shift+P');
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'shortcut',
        params: { chord: 'Cmd+Shift+P' },
      });
    });

    it('throws on an invalid modifier and never dispatches', async () => {
      const { page, pressedKeys } = makeKeyboardMockPage();
      const human = await createHuman(page);
      // `'Hyper+S'` is a TS error too (Hyper isn't a `ShortcutModifier`),
      // so the type guard is the first line of defense. The cast exercises
      // the runtime fallback — important because real callers might pass
      // strings from config / user input that TS can't validate at compile.
      // Cast to `Shortcut` (not `any` / `never`) — same pattern as the
      // `asChord` helper in `keyboard.test.ts`.
      await expect(human.shortcut('Hyper+S' as Shortcut)).rejects.toThrow(
        /Invalid shortcut modifier/,
      );
      expect(pressedKeys).toEqual([]);
    });
  });

  describe('rightClick', () => {
    it("dispatches mouse.click with button: 'right' in human mode", async () => {
      const { page, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.rightClick('button');
      expect(mouseClicks).toHaveLength(1);
      expect(mouseClicks[0]?.button).toBe('right');
    });

    it("emits a 'rightClick' action to plugins (not 'click')", async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.rightClick('button');
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'rightClick',
        params: { target: 'button' },
      });
    });

    it('in instant mode, falls back to locator.click with the right button', async () => {
      const { page, locator, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.rightClick('button');
      expect(locator.click).toHaveBeenCalledWith({ button: 'right' });
      // Humanized motion path is skipped — no synthetic mouse.click events.
      expect(mouseClicks).toEqual([]);
    });
  });

  describe('hover', () => {
    it('moves the mouse to the target without clicking', async () => {
      const { page, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.hover('button');
      // The whole point of hover: motion happens, no click.
      expect(mouseClicks).toEqual([]);
    });

    it('walks the mouse along a path (mouse.move is called)', async () => {
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.hover('button');
      // Bezier path produces many move events. We just need to confirm
      // motion happened at all — exact step count is path-implementation-
      // dependent and would make this test brittle.
      const movesCalled = (page.mouse.move as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(movesCalled).toBeGreaterThan(0);
    });

    it("emits a 'hover' action to plugins", async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.hover('button');
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'hover',
        params: { target: 'button' },
      });
    });

    it('in instant mode, dispatches a single mouse.move to the element center', async () => {
      const { page, mouseClicks } = makeKeyboardMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.hover('button');
      // Element center: bounding box is (100, 100, 40, 40) → center is (120, 120).
      expect(page.mouse.move).toHaveBeenCalledWith(120, 120);
      expect(mouseClicks).toEqual([]);
    });
  });

  describe('move', () => {
    it('moves the cursor along a path without clicking', async () => {
      const { page, mouseClicks, mouseButtonEvents } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.move('#target');
      // Pure positioning: no click, no button events.
      expect(mouseClicks).toEqual([]);
      expect(mouseButtonEvents).toEqual([]);
      // Mouse.move was called multiple times (path walk).
      const movesCalled = (page.mouse.move as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(movesCalled).toBeGreaterThan(0);
    });

    it('accepts a raw Point and skips DOM resolution', async () => {
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.move({ x: 600, y: 400 });
      // Point input → no locator() lookup, no boundingBox() call.
      expect(page.locator).not.toHaveBeenCalled();
    });

    it('accepts a selector and resolves to the element', async () => {
      const { page, locator } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.move('#target');
      expect(page.locator).toHaveBeenCalledWith('#target');
      expect(locator.boundingBox).toHaveBeenCalled();
    });

    it("emits a 'move' action with the resolved target description to plugins", async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.move({ x: 400, y: 220 });
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'move',
        params: { target: 'point(400, 220)' },
      });
    });

    it('does NOT emit a hover event (move is distinct from hover)', async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.move('#target');
      const types = beforeAction.mock.calls.map((c) => (c[0] as { type: string }).type);
      expect(types).toEqual(['move']);
      expect(types).not.toContain('hover');
    });

    it('in instant mode, dispatches one mouse.move at the resolved coordinates', async () => {
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.move({ x: 250, y: 100 });
      // Instant mode = single move, no path walk.
      const moves = (page.mouse.move as ReturnType<typeof vi.fn>).mock.calls;
      expect(moves).toHaveLength(1);
      expect(moves[0]).toEqual([250, 100]);
    });
  });

  describe('drag', () => {
    it('dispatches mouse.down then mouse.up around the motion', async () => {
      const { page, mouseButtonEvents } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.drag('#card', '#slot');
      // Order is load-bearing: every drag is exactly down → ... → up.
      // Both must fire, and in that order.
      expect(mouseButtonEvents).toEqual(['down', 'up']);
    });

    it('accepts raw Point coordinates for either endpoint', async () => {
      const { page, mouseButtonEvents } = makeKeyboardMockPage();
      const human = await createHuman(page);
      // No bounding-box lookup is needed for raw Points — the locator's
      // boundingBox mock would still be called if the selector branch ran,
      // but for the destination it shouldn't be.
      await human.drag('#card', { x: 400, y: 250 });
      expect(mouseButtonEvents).toEqual(['down', 'up']);
    });

    it('accepts Point for both endpoints (no DOM resolution needed at all)', async () => {
      const { page, mouseButtonEvents } = makeKeyboardMockPage();
      const human = await createHuman(page);
      await human.drag({ x: 10, y: 10 }, { x: 200, y: 200 });
      expect(mouseButtonEvents).toEqual(['down', 'up']);
      // locator() should never be called when both endpoints are Points.
      expect(page.locator).not.toHaveBeenCalled();
    });

    it("emits a 'drag' action with both endpoint descriptions to plugins", async () => {
      const beforeAction = vi.fn();
      const { page } = makeKeyboardMockPage();
      const human = await createHuman(page, { plugins: [{ name: 'p', beforeAction }] });
      await human.drag('#card', { x: 400, y: 250 });
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'drag',
        params: { from: '#card', to: 'point(400, 250)' },
      });
    });

    it('in instant mode, fires down → move → up at the endpoints', async () => {
      const { page, mouseButtonEvents } = makeKeyboardMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.drag({ x: 10, y: 10 }, { x: 200, y: 50 });
      expect(mouseButtonEvents).toEqual(['down', 'up']);
      // Exactly two moves in instant mode: one to the source, one to the dest.
      const moves = (page.mouse.move as ReturnType<typeof vi.fn>).mock.calls;
      expect(moves).toHaveLength(2);
      expect(moves[0]).toEqual([10, 10]);
      expect(moves[1]).toEqual([200, 50]);
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

  describe('scroll', () => {
    it("defaults to 'natural' = one full viewport down when called with no args", async () => {
      const { page, wheelDeltas } = makeScrollMockPage({
        scrollY: 0,
        viewport: 800,
        docHeight: 5000,
      });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll();
      // Instant mode short-circuits — no wheel events.
      expect(wheelDeltas).toEqual([]);
      // Target = scrollY + viewport = 0 + 800.
      expect(result.to).toBe(800);
      expect(result.from).toBe(0);
      expect(result.distance).toBe(800);
    });

    it("'top' scrolls to Y = 0", async () => {
      const { page, scrollToCalls } = makeScrollMockPage({ scrollY: 2000 });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('top');
      expect(result.to).toBe(0);
      expect(scrollToCalls).toEqual([0]);
    });

    it("'end' scrolls to (docHeight - viewport), clamped non-negative", async () => {
      const { page, scrollToCalls } = makeScrollMockPage({
        scrollY: 0,
        viewport: 800,
        docHeight: 5000,
      });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('end');
      // Aim: 5000; clamped to docHeight - viewport = 4200.
      expect(result.to).toBe(4200);
      expect(scrollToCalls).toEqual([4200]);
    });

    it('{ by: N } scrolls by a relative pixel delta', async () => {
      const { page, scrollToCalls } = makeScrollMockPage({ scrollY: 200 });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll({ by: 500 });
      expect(result.to).toBe(700);
      expect(scrollToCalls).toEqual([700]);
    });

    it('{ to: N } scrolls to an absolute Y', async () => {
      const { page, scrollToCalls } = makeScrollMockPage({ scrollY: 200 });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll({ to: 1200 });
      expect(result.to).toBe(1200);
      expect(scrollToCalls).toEqual([1200]);
    });

    it('resolves a string selector via locator.boundingBox', async () => {
      const { page, locator } = makeScrollMockPage({
        scrollY: 100,
        elementY: 600, // viewport-relative top of element
      });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('#footer');
      expect(page.locator).toHaveBeenCalledWith('#footer');
      expect(locator.boundingBox).toHaveBeenCalled();
      // Absolute Y = scrollY + rect.y = 100 + 600 = 700, block: 'start' default.
      expect(result.to).toBe(700);
    });

    it('accepts a Locator directly without going through page.locator', async () => {
      const { page, locator } = makeScrollMockPage({ scrollY: 0, elementY: 1000 });
      const human = await createHuman(page, { speed: 'instant' });
      await human.scroll(locator as unknown as Locator);
      expect(page.locator).not.toHaveBeenCalled();
      expect(locator.boundingBox).toHaveBeenCalled();
    });

    it('returns to === from when distance is zero (no wheel, no scrollTo)', async () => {
      const { page, wheelDeltas, scrollToCalls } = makeScrollMockPage({
        scrollY: 0,
        viewport: 800,
        docHeight: 800, // page fits in viewport
      });
      const human = await createHuman(page, { speed: 'human' });
      const result = await human.scroll('top');
      expect(result.distance).toBe(0);
      expect(result.durationMs).toBe(0);
      expect(wheelDeltas).toEqual([]);
      expect(scrollToCalls).toEqual([]);
    });

    it('dispatches multiple wheel events in human speed', async () => {
      const { page, wheelDeltas } = makeScrollMockPage({
        scrollY: 0,
        viewport: 800,
        docHeight: 5000,
      });
      const human = await createHuman(page, { speed: 'human', seed: 'wheel-1' });
      await human.scroll({ by: 1500 });
      // Multi-segment plan → many wheel calls (at least a few).
      expect(wheelDeltas.length).toBeGreaterThan(5);
      // Sum of deltas approximates the requested distance.
      const total = wheelDeltas.reduce((s, d) => s + d, 0);
      expect(total).toBeCloseTo(1500, 0);
    });

    it("emits a 'scroll' action with target description for plugins", async () => {
      const beforeAction = vi.fn();
      const afterAction = vi.fn();
      const { page } = makeScrollMockPage({ scrollY: 0 });
      const human = await createHuman(page, {
        speed: 'instant',
        plugins: [{ name: 'p', beforeAction, afterAction }],
      });
      await human.scroll({ to: 500 });
      expect(beforeAction).toHaveBeenCalledWith({
        type: 'scroll',
        params: { target: 'to:500' },
      });
      const result = afterAction.mock.calls[0]?.[1];
      expect(result.type).toBe('scroll');
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('clamps to-element targets to the document bounds', async () => {
      // Element is far below the bottom; the scroll should stop at the max
      // scrollable Y (docHeight - viewport), not run off the end.
      const { page } = makeScrollMockPage({
        scrollY: 0,
        viewport: 800,
        docHeight: 3000,
        elementY: 10_000, // way past document end
      });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('#unreachable');
      expect(result.to).toBe(2200); // 3000 - 800
    });

    it('stays put when the element resolves to null (gone from DOM)', async () => {
      const { page } = makeScrollMockPage({ scrollY: 400, elementBox: null });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('#gone');
      expect(result.to).toBe(400);
      expect(result.distance).toBe(0);
    });

    it("block: 'nearest' stays put when the element is already fully visible", async () => {
      // Element occupies viewport rows 100..300, viewport is 0..800 → fully in view.
      const { page } = makeScrollMockPage({
        scrollY: 500,
        viewport: 800,
        elementBox: { x: 0, y: 100, width: 200, height: 200 },
      });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('#visible', { block: 'nearest' });
      expect(result.to).toBe(500);
      expect(result.distance).toBe(0);
    });

    it("block: 'nearest' scrolls down just enough when element is below the viewport", async () => {
      // Element top is at viewport-relative y = 900 (200px below viewport bottom 800).
      // Nearest brings its bottom edge (1100 → absolute 1500 + 0 from = 1500) to viewport-bottom.
      const { page } = makeScrollMockPage({
        scrollY: 0,
        viewport: 800,
        elementBox: { x: 0, y: 900, width: 200, height: 200 },
      });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('#below', { block: 'nearest' });
      // absoluteBottom - viewport = (0 + 900 + 200) - 800 = 300
      expect(result.to).toBe(300);
    });

    it("block: 'nearest' scrolls up just enough when element is above the viewport", async () => {
      // Element top is at viewport-relative y = -300 (300px above viewport top).
      // Nearest brings its top edge to viewport-top.
      const { page } = makeScrollMockPage({
        scrollY: 1000,
        viewport: 800,
        elementBox: { x: 0, y: -300, width: 200, height: 200 },
      });
      const human = await createHuman(page, { speed: 'instant' });
      const result = await human.scroll('#above', { block: 'nearest' });
      // absoluteTop = scrollY + rect.y = 1000 + -300 = 700
      expect(result.to).toBe(700);
    });

    describe("axis: 'x' (horizontal)", () => {
      it("'natural' scrolls one viewport-width right", async () => {
        const { page, scrollToCalls } = makeScrollMockPage({
          scrollY: 0,
          viewport: 1200,
          docHeight: 5000, // doubles as scrollWidth in the mock
        });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll('natural', { axis: 'x' });
        expect(result.from).toBe(0);
        expect(result.to).toBe(1200);
        expect(scrollToCalls).toEqual([1200]);
      });

      it("'end' scrolls to (scrollWidth - viewport)", async () => {
        const { page, scrollToCalls } = makeScrollMockPage({
          scrollY: 0,
          viewport: 1200,
          docHeight: 5000,
        });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll('end', { axis: 'x' });
        expect(result.to).toBe(3800); // 5000 - 1200
        expect(scrollToCalls).toEqual([3800]);
      });

      it('{ by: N } scrolls by a relative pixel delta on the X axis', async () => {
        const { page, scrollToCalls } = makeScrollMockPage({ scrollY: 500 });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll({ by: 400 }, { axis: 'x' });
        expect(result.to).toBe(900);
        expect(scrollToCalls).toEqual([900]);
      });

      it('{ to: N } sets the absolute scrollX position', async () => {
        const { page, scrollToCalls } = makeScrollMockPage({ scrollY: 0 });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll({ to: 1500 }, { axis: 'x' });
        expect(result.to).toBe(1500);
        expect(scrollToCalls).toEqual([1500]);
      });

      it('dispatches wheel events on the X axis (not Y) in humanized mode', async () => {
        const { page, wheelDeltas, wheelDeltasX } = makeScrollMockPage({
          scrollY: 0,
          viewport: 1200,
          docHeight: 5000,
        });
        const human = await createHuman(page, { speed: 'human', seed: 'x-wheel' });
        await human.scroll({ by: 1000 }, { axis: 'x' });
        // Every Y delta is zero — motion is purely horizontal.
        expect(wheelDeltas.every((d) => d === 0)).toBe(true);
        // X deltas sum approximately to the requested distance.
        const totalX = wheelDeltasX.reduce((s, d) => s + d, 0);
        expect(totalX).toBeCloseTo(1000, 0);
        expect(wheelDeltasX.length).toBeGreaterThan(5);
      });

      it('resolves an element target via rect.x (not rect.y) on the X axis', async () => {
        const { page } = makeScrollMockPage({
          scrollY: 100,
          viewport: 1200,
          // Element rect: x=900 viewport-relative, width=200, height=100
          elementBox: { x: 900, y: 0, width: 200, height: 100 },
        });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll('#card', { axis: 'x', block: 'start' });
        // absoluteX = scrollX + rect.x = 100 + 900 = 1000
        expect(result.to).toBe(1000);
      });
    });

    describe('within (scrollable container)', () => {
      /**
       * Container mock for `within`-scroll tests. Routes container.evaluate
       * by inspecting the second arg's shape:
       *   - `{ axis, pos }`   → `el.scrollTo(...)` in instant mode
       *   - `{ axis, delta }` → `el.scrollLeft += delta` / `scrollTop += delta`
       *                          per humanized segment
       *   - axis-only string  → geometry read
       *
       * Tightly coupled to the executor's internal arg field names (`pos`,
       * `delta`). Rename either side without updating both and tests pass
       * silently while no calls are recorded.
       */
      function makeWithinMockPage(
        options: {
          scrollTop?: number;
          clientHeight?: number;
          scrollHeight?: number;
          containerRect?: { left: number; top: number; width: number; height: number };
        } = {},
      ): {
        page: Page;
        container: MockLocator;
        containerScrollToCalls: number[];
        containerScrollByCalls: number[];
        wheelDeltas: number[];
        mouseMoves: Array<{ x: number; y: number }>;
      } {
        const scrollTop = options.scrollTop ?? 0;
        const clientHeight = options.clientHeight ?? 400;
        const scrollHeight = options.scrollHeight ?? 2000;
        const rect = options.containerRect ?? { left: 100, top: 100, width: 600, height: 400 };
        const containerScrollToCalls: number[] = [];
        const containerScrollByCalls: number[] = [];
        const wheelDeltas: number[] = [];
        const mouseMoves: Array<{ x: number; y: number }> = [];

        const container: MockLocator = {
          focus: vi.fn().mockResolvedValue(undefined),
          pressSequentially: vi.fn().mockResolvedValue(undefined),
          evaluate: vi.fn().mockImplementation((_fn: unknown, arg?: unknown) => {
            // Arg form distinguishes the three container.evaluate paths:
            //  - `{ axis, pos }`  → container.scrollTo (instant mode)
            //  - `{ axis, delta }` → container.scrollBy (humanized walk)
            //  - axis-only string  → container geometry read
            if (arg && typeof arg === 'object' && 'pos' in arg) {
              containerScrollToCalls.push((arg as { pos: number }).pos);
              return Promise.resolve(undefined);
            }
            if (arg && typeof arg === 'object' && 'delta' in arg) {
              containerScrollByCalls.push((arg as { delta: number }).delta);
              return Promise.resolve(undefined);
            }
            return Promise.resolve({
              current: scrollTop,
              viewport: clientHeight,
              total: scrollHeight,
              hover: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
            });
          }),
        };
        const page = {
          goto: vi.fn().mockResolvedValue(null),
          locator: vi.fn().mockReturnValue(container as unknown as Locator),
          keyboard: { press: vi.fn().mockResolvedValue(undefined) },
          mouse: {
            move: vi.fn().mockImplementation((x: number, y: number) => {
              mouseMoves.push({ x, y });
              return Promise.resolve();
            }),
            wheel: vi.fn().mockImplementation((_dx: number, dy: number) => {
              wheelDeltas.push(dy);
              return Promise.resolve();
            }),
          },
        } as unknown as Page;
        return {
          page,
          container,
          containerScrollToCalls,
          containerScrollByCalls,
          wheelDeltas,
          mouseMoves,
        };
      }

      it("'natural' scrolls one container clientHeight down", async () => {
        const { page, container } = makeWithinMockPage({
          scrollTop: 0,
          clientHeight: 400,
          scrollHeight: 2000,
        });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll('natural', { within: '#messages' });
        expect(page.locator).toHaveBeenCalledWith('#messages');
        expect(container.evaluate).toHaveBeenCalled();
        // One container-viewport down.
        expect(result.to).toBe(400);
        expect(result.from).toBe(0);
      });

      it("'end' scrolls to (scrollHeight - clientHeight) of the container", async () => {
        const { page, containerScrollToCalls } = makeWithinMockPage({
          scrollTop: 0,
          clientHeight: 400,
          scrollHeight: 2000,
        });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll('end', { within: '.thread' });
        expect(result.to).toBe(1600); // 2000 - 400
        expect(containerScrollToCalls).toEqual([1600]);
      });

      it("'top' scrolls the container to scrollTop = 0", async () => {
        const { page, containerScrollToCalls } = makeWithinMockPage({ scrollTop: 800 });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll('top', { within: '#log' });
        expect(result.to).toBe(0);
        expect(containerScrollToCalls).toEqual([0]);
      });

      it('{ by: N } scrolls the container relative to its scrollTop', async () => {
        const { page, containerScrollToCalls } = makeWithinMockPage({ scrollTop: 200 });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll({ by: 300 }, { within: '#log' });
        expect(result.to).toBe(500);
        expect(containerScrollToCalls).toEqual([500]);
      });

      it('{ to: N } sets the container scrollTop directly', async () => {
        const { page, containerScrollToCalls } = makeWithinMockPage({ scrollTop: 200 });
        const human = await createHuman(page, { speed: 'instant' });
        const result = await human.scroll({ to: 700 }, { within: '#log' });
        expect(result.to).toBe(700);
        expect(containerScrollToCalls).toEqual([700]);
      });

      it('routes instant-mode scrolls through container.evaluate, not page.evaluate', async () => {
        const { page, containerScrollToCalls } = makeWithinMockPage({ scrollTop: 0 });
        const human = await createHuman(page, { speed: 'instant' });
        await human.scroll({ to: 500 }, { within: '#log' });
        expect(containerScrollToCalls).toEqual([500]);
        // The window evaluate should not have been touched for this scroll.
        expect((page as unknown as { evaluate?: unknown }).evaluate).toBeUndefined();
      });

      it('parks the cursor over the container center and applies scrollBy per segment', async () => {
        const { page, mouseMoves, containerScrollByCalls } = makeWithinMockPage({
          scrollTop: 0,
          clientHeight: 400,
          scrollHeight: 2000,
          containerRect: { left: 100, top: 100, width: 600, height: 400 },
        });
        const human = await createHuman(page, { speed: 'human', seed: 'within-1' });
        await human.scroll({ by: 300 }, { within: '#log' });
        // First mouse move is the cursor parking at the container center.
        expect(mouseMoves[0]).toEqual({ x: 400, y: 300 });
        // Each non-pause segment dispatches a container.scrollBy. The sum
        // approximates the requested distance (excludes any pause segments).
        expect(containerScrollByCalls.length).toBeGreaterThan(0);
        const totalDelta = containerScrollByCalls.reduce((s, d) => s + d, 0);
        expect(totalDelta).toBeCloseTo(300, 0);
      });

      it('horizontal scroll inside a container uses scrollBy on the X axis', async () => {
        const { page, containerScrollByCalls } = makeWithinMockPage({
          scrollTop: 0,
          clientHeight: 400,
          scrollHeight: 2000,
        });
        const human = await createHuman(page, { speed: 'human', seed: 'within-x' });
        await human.scroll({ by: 600 }, { within: '#carousel', axis: 'x' });
        // scrollBy was invoked on the X axis — total deltas approximate
        // the requested horizontal distance.
        const totalDelta = containerScrollByCalls.reduce((s, d) => s + d, 0);
        expect(containerScrollByCalls.length).toBeGreaterThan(0);
        expect(totalDelta).toBeCloseTo(600, 0);
      });
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
