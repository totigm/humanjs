import type { HumanPlugin } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createHuman } from './index';

interface MockLocator {
  focus: ReturnType<typeof vi.fn>;
  pressSequentially: ReturnType<typeof vi.fn>;
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
