import type { HumanPlugin } from '@humanjs/core';
import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createHuman } from './index.js';

function makeMockPage(overrides: Partial<Page> = {}): Page {
  return {
    goto: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as Page;
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
