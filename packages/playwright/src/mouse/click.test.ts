import type { Locator, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createHuman } from '../index';

interface MockBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface MockLocator {
  readonly boundingBox: ReturnType<typeof vi.fn>;
  readonly click: ReturnType<typeof vi.fn>;
}

function makeMockLocator(box: MockBoundingBox | null = defaultBox): MockLocator {
  return {
    boundingBox: vi.fn().mockResolvedValue(box),
    click: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockPage(locatorOverride?: MockLocator): {
  page: Page;
  locator: MockLocator;
  mouseMove: ReturnType<typeof vi.fn>;
  mouseClick: ReturnType<typeof vi.fn>;
} {
  const locator = locatorOverride ?? makeMockLocator();
  const mouseMove = vi.fn().mockResolvedValue(undefined);
  const mouseClick = vi.fn().mockResolvedValue(undefined);
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn(() => locator),
    mouse: {
      move: mouseMove,
      click: mouseClick,
    },
  } as unknown as Page;
  return { page, locator, mouseMove, mouseClick };
}

const defaultBox: MockBoundingBox = { x: 100, y: 200, width: 80, height: 30 };

describe('human.click', () => {
  describe('basic flow', () => {
    it('resolves the target via page.locator', async () => {
      const { page } = makeMockPage();
      const human = await createHuman(page, { speed: 'fast' });
      await human.click('button');
      expect(page.locator).toHaveBeenCalledWith('button');
    });

    it('walks the mouse along multiple points before clicking', async () => {
      const { page, mouseMove, mouseClick } = makeMockPage();
      const human = await createHuman(page, { speed: 'fast' });
      await human.click('button');
      // bezierPath default = 25 steps → 26 points, all walked through.
      expect(mouseMove.mock.calls.length).toBeGreaterThan(10);
      expect(mouseClick).toHaveBeenCalledTimes(1);
      // Last move precedes the click.
      const lastMoveOrder = mouseMove.mock.invocationCallOrder.at(-1) ?? 0;
      const clickOrder = mouseClick.mock.invocationCallOrder[0] ?? 0;
      expect(clickOrder).toBeGreaterThan(lastMoveOrder);
    });

    it('clicks at coordinates inside the target bounding box', async () => {
      const { page, mouseClick } = makeMockPage();
      const human = await createHuman(page, { speed: 'fast' });
      await human.click('button');
      const [clickX, clickY] = mouseClick.mock.calls[0] ?? [0, 0];
      expect(clickX).toBeGreaterThanOrEqual(defaultBox.x);
      expect(clickX).toBeLessThanOrEqual(defaultBox.x + defaultBox.width);
      expect(clickY).toBeGreaterThanOrEqual(defaultBox.y);
      expect(clickY).toBeLessThanOrEqual(defaultBox.y + defaultBox.height);
    });

    it('does not always click dead-center', async () => {
      // Two seeds should produce visibly different click points.
      const { page: page1, mouseClick: click1 } = makeMockPage();
      const { page: page2, mouseClick: click2 } = makeMockPage();
      const h1 = await createHuman(page1, { seed: 'seed-a', speed: 'fast' });
      const h2 = await createHuman(page2, { seed: 'seed-b', speed: 'fast' });
      await h1.click('button');
      await h2.click('button');
      const [x1, y1] = click1.mock.calls[0] ?? [0, 0];
      const [x2, y2] = click2.mock.calls[0] ?? [0, 0];
      expect(x1 !== x2 || y1 !== y2).toBe(true);
    });
  });

  describe('speed: instant', () => {
    it("uses the locator's native click and skips humanized mouse moves", async () => {
      const { page, locator, mouseMove } = makeMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.click('button');
      expect(locator.click).toHaveBeenCalledTimes(1);
      expect(mouseMove).not.toHaveBeenCalled();
    });
  });

  describe('plugin lifecycle', () => {
    it('emits a click action through the plugin pipeline', async () => {
      const beforeAction = vi.fn();
      const afterAction = vi.fn();
      const { page } = makeMockPage();
      const human = await createHuman(page, {
        speed: 'fast',
        plugins: [{ name: 'p', beforeAction, afterAction }],
      });
      await human.click('button');
      expect(beforeAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'click', params: { target: 'button' } }),
      );
      expect(afterAction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'click' }),
        expect.objectContaining({ type: 'click', durationMs: expect.any(Number) }),
      );
    });

    it('notifies onError and re-throws when the target is not found', async () => {
      const locator = makeMockLocator(null);
      const { page } = makeMockPage(locator);
      const onError = vi.fn();
      const human = await createHuman(page, {
        speed: 'fast',
        plugins: [{ name: 'p', onError }],
      });
      await expect(human.click('missing')).rejects.toThrow(/element not found/i);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'click' }),
        expect.any(Error),
      );
    });
  });

  describe('determinism', () => {
    it('produces identical mouse trajectories for identical seeds', async () => {
      const { page: page1, mouseMove: move1 } = makeMockPage();
      const { page: page2, mouseMove: move2 } = makeMockPage();
      const h1 = await createHuman(page1, { seed: 'reproducible', speed: 'fast' });
      const h2 = await createHuman(page2, { seed: 'reproducible', speed: 'fast' });
      await h1.click('button');
      await h2.click('button');
      expect(move1.mock.calls).toEqual(move2.mock.calls);
    });
  });

  describe('input shapes', () => {
    it('accepts a Locator object directly', async () => {
      const { page, mouseClick } = makeMockPage();
      const locator: MockLocator = {
        boundingBox: vi.fn().mockResolvedValue(defaultBox),
        click: vi.fn().mockResolvedValue(undefined),
      };
      const human = await createHuman(page, { speed: 'fast' });
      await human.click(locator as unknown as Locator);
      // Did NOT route through page.locator
      expect(page.locator).not.toHaveBeenCalled();
      // Did read the bounding box from the supplied locator
      expect(locator.boundingBox).toHaveBeenCalled();
      expect(mouseClick).toHaveBeenCalled();
    });
  });

  describe('dwell timing', () => {
    it('pauses for Personality.dwell.preClickMs before clicking', async () => {
      const afterAction = vi.fn();
      const { page, mouseMove, mouseClick } = makeMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          dwell: { preClickMs: 200, preClickJitter: 0, postActionMs: 0, postActionJitter: 0 },
        },
        speed: 'fast',
        seed: 'dwell-pre',
        plugins: [{ name: 'p', afterAction }],
      });
      const start = Date.now();
      await human.click('button');
      const elapsed = Date.now() - start;
      // preClickMs=200 × personality.speed=1.0 (careful) × speedMode=0.5 (fast) = 100ms minimum.
      // Allow generous slack for the walk + scheduling overhead.
      expect(elapsed).toBeGreaterThanOrEqual(100);
      // Sanity: walk completed before click, dwell came between.
      const lastMoveOrder = mouseMove.mock.invocationCallOrder.at(-1) ?? 0;
      const clickOrder = mouseClick.mock.invocationCallOrder[0] ?? 0;
      expect(clickOrder).toBeGreaterThan(lastMoveOrder);
    });

    it('pauses for Personality.dwell.postActionMs after clicking', async () => {
      const afterAction = vi.fn();
      const { page } = makeMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          dwell: { preClickMs: 0, preClickJitter: 0, postActionMs: 200, postActionJitter: 0 },
        },
        speed: 'fast',
        seed: 'dwell-post',
        plugins: [{ name: 'p', afterAction }],
      });
      const start = Date.now();
      await human.click('button');
      const elapsed = Date.now() - start;
      // postActionMs=200 × 1.0 × 0.5 = 100ms minimum.
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('skips both dwells in speed: instant', async () => {
      const { page } = makeMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          dwell: { preClickMs: 1000, preClickJitter: 0, postActionMs: 1000, postActionJitter: 0 },
        },
        speed: 'instant',
        seed: 'dwell-instant',
      });
      const start = Date.now();
      await human.click('button');
      const elapsed = Date.now() - start;
      // 'instant' uses locator.click() directly — no walk, no dwell.
      expect(elapsed).toBeLessThan(100);
    });

    it('treats zero dwell as a no-op (no sleep at all)', async () => {
      const { page } = makeMockPage();
      const human = await createHuman(page, {
        personality: {
          extends: 'careful',
          dwell: { preClickMs: 0, preClickJitter: 0, postActionMs: 0, postActionJitter: 0 },
        },
        speed: 'fast',
        seed: 'dwell-zero',
      });
      const start = Date.now();
      await human.click('button');
      const elapsed = Date.now() - start;
      // No dwell + 'fast' walk = brief duration. Walk distance from (0,0) to
      // ~(140, 215) ≈ 258px at 450ms/1000px × 0.5 speedMode ≈ 58ms.
      expect(elapsed).toBeLessThan(300);
    });
  });

  describe('continuity', () => {
    it('starts subsequent paths from the previous click point', async () => {
      const { page, mouseMove } = makeMockPage();
      const human = await createHuman(page, { seed: 'continuity', speed: 'fast' });

      await human.click('button');
      const firstClickEnd = mouseMove.mock.calls.at(-1) as [number, number];

      mouseMove.mockClear();
      await human.click('button');
      const secondPathStart = mouseMove.mock.calls[0] as [number, number];

      // The new path's first point should be near the previous end (the prior
      // click landed there). Allowing some jitter slack.
      expect(Math.abs(secondPathStart[0] - firstClickEnd[0])).toBeLessThan(5);
      expect(Math.abs(secondPathStart[1] - firstClickEnd[1])).toBeLessThan(5);
    });
  });
});
