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
  readonly scrollIntoViewIfNeeded: ReturnType<typeof vi.fn>;
}

function makeMockLocator(box: MockBoundingBox | null = defaultBox): MockLocator {
  return {
    boundingBox: vi.fn().mockResolvedValue(box),
    click: vi.fn().mockResolvedValue(undefined),
    // Required for any test whose box falls outside the 1280×720 mock
    // viewport — the auto-scroll path calls this in instant mode and
    // re-reads boundingBox after. Always-present mock prevents future
    // off-viewport tests from crashing with "not a function".
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockPage(locatorOverride?: MockLocator): {
  page: Page;
  locator: MockLocator;
  mouseMove: ReturnType<typeof vi.fn>;
  mouseClick: ReturnType<typeof vi.fn>;
  mouseWheel: ReturnType<typeof vi.fn>;
} {
  const locator = locatorOverride ?? makeMockLocator();
  const mouseMove = vi.fn().mockResolvedValue(undefined);
  const mouseClick = vi.fn().mockResolvedValue(undefined);
  // Wheel is part of the default mock surface so auto-scroll tests can
  // assert against it directly. Without it baked in, every off-viewport
  // test would have to cast `page` to inject a wheel mock — noisy at the
  // call site and easy to get subtly wrong.
  const mouseWheel = vi.fn().mockResolvedValue(undefined);
  const page = {
    goto: vi.fn().mockResolvedValue(null),
    locator: vi.fn(() => locator),
    // Default `evaluate` returns 0 — enough to satisfy `readScrollY`'s
    // `window.scrollY` read in tests that don't model scroll state. Tests
    // that exercise `executeScroll` paths (which evaluates document
    // geometry instead) construct their own page mock with a richer
    // `evaluate` stub.
    evaluate: vi.fn().mockResolvedValue(0),
    mouse: {
      move: mouseMove,
      click: mouseClick,
      wheel: mouseWheel,
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
    },
    viewportSize: () => ({ width: 1280, height: 720 }),
  } as unknown as Page;
  return { page, locator, mouseMove, mouseClick, mouseWheel };
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

    it('clicks off-center via Gaussian offset from the box center', async () => {
      const { page, mouseClick } = makeMockPage();
      const human = await createHuman(page, { seed: 'off-center', speed: 'fast' });
      await human.click('button');
      const [clickX, clickY] = mouseClick.mock.calls[0] ?? [0, 0];
      const centerX = defaultBox.x + defaultBox.width / 2;
      const centerY = defaultBox.y + defaultBox.height / 2;
      // With any non-zero Gaussian draw, the click is off the geometric center.
      // (Both axes hitting exactly 0 simultaneously has effectively zero probability.)
      expect(clickX !== centerX || clickY !== centerY).toBe(true);
      // And it still falls inside the box.
      expect(clickX).toBeGreaterThanOrEqual(defaultBox.x);
      expect(clickX).toBeLessThanOrEqual(defaultBox.x + defaultBox.width);
      expect(clickY).toBeGreaterThanOrEqual(defaultBox.y);
      expect(clickY).toBeLessThanOrEqual(defaultBox.y + defaultBox.height);
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
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      };
      const human = await createHuman(page, { speed: 'fast' });
      await human.click(locator as unknown as Locator);
      // Did NOT route through page.locator
      expect(page.locator).not.toHaveBeenCalled();
      // Did read the bounding box from the supplied locator
      expect(locator.boundingBox).toHaveBeenCalled();
      expect(mouseClick).toHaveBeenCalled();
    });

    it('clicks a raw Point at the exact coordinates (humanized)', async () => {
      const { page, mouseClick, mouseMove } = makeMockPage();
      const human = await createHuman(page, { speed: 'fast', seed: 'click-point' });
      await human.click({ x: 640, y: 360 });
      // No element resolution — raw coordinates are clicked as-is.
      expect(page.locator).not.toHaveBeenCalled();
      // Walked there along a Bezier path, then clicked the exact point.
      expect(mouseMove).toHaveBeenCalled();
      const [clickX, clickY] = mouseClick.mock.calls[0] ?? [0, 0];
      expect(clickX).toBe(640);
      expect(clickY).toBe(360);
    });

    it('clicks a raw Point in instant mode via mouse.click (no locator)', async () => {
      const { page, mouseClick, locator } = makeMockPage();
      const human = await createHuman(page, { speed: 'instant' });
      await human.click({ x: 200, y: 150 });
      expect(page.locator).not.toHaveBeenCalled();
      expect(locator.click).not.toHaveBeenCalled();
      expect(mouseClick).toHaveBeenCalledWith(200, 150, { button: 'left' });
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

      // humanizePath preserves endpoints exactly, and setMousePosition is
      // committed to targetPoint before the click — so the next path's first
      // point should equal the previous path's last point with no slack.
      expect(secondPathStart[0]).toBe(firstClickEnd[0]);
      expect(secondPathStart[1]).toBe(firstClickEnd[1]);
    });
  });

  describe('auto-scroll into view', () => {
    it('triggers a humanized scroll when the target is below the viewport', async () => {
      // Real-browser flow: `boundingBox()` returns y=2000 while the element
      // is below the fold; once a wheel-scroll moves the document, the next
      // read returns the post-scroll viewport-relative y. The mock mirrors
      // this — boundingBox responses flip as soon as a wheel event lands.
      const offViewportBox: MockBoundingBox = { x: 100, y: 2000, width: 80, height: 30 };
      const inViewportBox: MockBoundingBox = { x: 100, y: 0, width: 80, height: 30 };
      let scrolled = false;
      const wheelCalls: Array<{ dx: number; dy: number }> = [];

      const locator: MockLocator = {
        boundingBox: vi.fn(() => Promise.resolve(scrolled ? inViewportBox : offViewportBox)),
        click: vi.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      };

      const mouseMove = vi.fn().mockResolvedValue(undefined);
      const mouseClick = vi.fn().mockResolvedValue(undefined);
      const page = {
        goto: vi.fn().mockResolvedValue(null),
        locator: vi.fn(() => locator),
        evaluate: vi.fn().mockResolvedValue({ current: 0, viewport: 720, total: 3000 }),
        mouse: {
          move: mouseMove,
          click: mouseClick,
          wheel: vi.fn().mockImplementation((dx: number, dy: number) => {
            wheelCalls.push({ dx, dy });
            scrolled = true;
            return Promise.resolve();
          }),
        },
        viewportSize: () => ({ width: 1280, height: 720 }),
      } as unknown as Page;

      const human = await createHuman(page, { speed: 'fast', seed: 'auto-scroll' });
      await human.click('button');

      // Wheel was dispatched at least once → humanized scroll happened.
      expect(wheelCalls.length).toBeGreaterThan(0);
      // The click landed on the in-viewport coordinates, not the original
      // off-screen y=2000. y is somewhere inside [0, 30] after the scroll.
      expect(mouseClick).toHaveBeenCalledTimes(1);
      const [, clickY] = mouseClick.mock.calls[0] as [number, number];
      expect(clickY).toBeGreaterThanOrEqual(0);
      expect(clickY).toBeLessThanOrEqual(30);
    });

    it('skips the scroll when the target is already inside the viewport', async () => {
      // Default box at (100, 200) sits comfortably inside the 1280×720 mock
      // viewport, so no scroll work should happen at all.
      const { page, mouseWheel } = makeMockPage();
      const human = await createHuman(page, { speed: 'fast', seed: 'no-scroll' });
      await human.click('button');
      expect(mouseWheel).not.toHaveBeenCalled();
    });

    it('does not auto-scroll for raw Point targets in drag', async () => {
      // Raw coordinates bypass the locator resolver entirely — the caller
      // chose the coordinates, so we don't second-guess them with a scroll.
      const { page, mouseWheel } = makeMockPage();
      const human = await createHuman(page, { speed: 'fast', seed: 'point-drag' });
      // Both endpoints are raw points, one of which is off-viewport (y=2000).
      // Auto-scroll must not fire — these are explicit coordinates.
      await human.drag({ x: 100, y: 200 }, { x: 400, y: 2000 });
      expect(mouseWheel).not.toHaveBeenCalled();
    });

    it('calls scrollIntoViewIfNeeded for off-viewport hovers in instant mode', async () => {
      // Instant mode bypasses humanized scrolling but the cursor still needs
      // to land at an in-viewport coordinate — otherwise mouse.move dispatches
      // off-screen. Mirrors what `locator.click()` does internally.
      const offViewportBox: MockBoundingBox = { x: 100, y: 2000, width: 80, height: 30 };
      const inViewportBox: MockBoundingBox = { x: 100, y: 300, width: 80, height: 30 };
      let scrolled = false;
      const locator: MockLocator = {
        boundingBox: vi.fn(() => Promise.resolve(scrolled ? inViewportBox : offViewportBox)),
        click: vi.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: vi.fn().mockImplementation(() => {
          scrolled = true;
          return Promise.resolve();
        }),
      };
      const { page } = makeMockPage(locator);

      const human = await createHuman(page, { speed: 'instant' });
      await human.hover('button');

      expect(locator.scrollIntoViewIfNeeded).toHaveBeenCalledTimes(1);
      // Cursor lands at the post-scroll in-viewport coordinates: center of
      // (100, 300, 80, 30) → (140, 315).
      expect(page.mouse.move).toHaveBeenCalledWith(140, 315);
    });
  });

  describe('misclick + recovery', () => {
    // Default target box: (100, 200, 80, 30). The misclick beat detours via
    // a point 5-15px outside the box, then back to a Gaussian point inside.
    // We can't reliably assert "all moves inside box" — the Bezier path
    // naturally traverses outside-the-box space on the way in from (0, 0).
    // Instead, compare move counts between misclick-off and misclick-on runs:
    // the misclick path adds a whole extra Bezier walk, so move count
    // roughly doubles. That's the robust signal.
    const insideBox = (x: number, y: number) => x >= 100 && x <= 180 && y >= 200 && y <= 230;

    async function clickAndCountMoves(misclickProbability: number, seed: string) {
      const { page, mouseMove, mouseClick } = makeMockPage();
      const human = await createHuman(page, {
        personality: { extends: 'careful', mouse: { misclickProbability } },
        speed: 'fast',
        seed,
      });
      await human.click('button');
      return {
        moveCount: mouseMove.mock.calls.length,
        clickCalls: mouseClick.mock.calls as Array<[number, number, { button?: string }?]>,
      };
    }

    it('click lands inside the target whether or not misclick fires', async () => {
      // Same seed, two settings: prob 0 and prob 1. In both cases the click
      // must land inside the target — the misclick is visual cursor motion
      // only, never a real click at off-target coordinates.
      const off = await clickAndCountMoves(0, 'same-seed');
      const on = await clickAndCountMoves(1, 'same-seed');

      for (const result of [off, on]) {
        expect(result.clickCalls).toHaveLength(1);
        const [x, y] = result.clickCalls[0] as [number, number];
        expect(insideBox(x, y)).toBe(true);
      }
    });

    it('misclick path adds a Bezier detour — more mouse.move calls vs no-misclick', async () => {
      // Robust signal: misclick on adds a whole extra walk-to-then-back leg,
      // which produces substantially more mouse.move events than the
      // straight walk. Avoids brittle assertions on specific coordinates.
      const off = await clickAndCountMoves(0, 'compare-seed');
      const on = await clickAndCountMoves(1, 'compare-seed');

      // The detour adds roughly a second Bezier path of moves. Conservative
      // assertion: at least 50% more moves with misclick enabled.
      expect(on.moveCount).toBeGreaterThan(off.moveCount * 1.5);
    });

    it('rightClick triggers misclick the same way (still a click action)', async () => {
      // Helper local to this test so we capture both the move count and
      // the right-button click args from each run.
      async function rightClick(misclickProbability: number, seed: string) {
        const { page, mouseMove, mouseClick } = makeMockPage();
        const human = await createHuman(page, {
          personality: { extends: 'careful', mouse: { misclickProbability } },
          speed: 'fast',
          seed,
        });
        await human.rightClick('button');
        return {
          moveCount: mouseMove.mock.calls.length,
          clickCalls: mouseClick.mock.calls as Array<[number, number, { button?: string }?]>,
        };
      }

      const off = await rightClick(0, 'right-misclick');
      const on = await rightClick(1, 'right-misclick');

      // Click fires once with button: 'right' inside the target box, regardless of misclick.
      for (const result of [off, on]) {
        expect(result.clickCalls).toHaveLength(1);
        const [x, y, opts] = result.clickCalls[0] as [number, number, { button?: string }];
        expect(opts?.button).toBe('right');
        expect(insideBox(x, y)).toBe(true);
      }

      // Misclick on adds a Bezier detour → substantially more mouse.move events.
      expect(on.moveCount).toBeGreaterThan(off.moveCount * 1.5);
    });

    it('hover does NOT misclick — same move count at probability 0 or 1', async () => {
      // Hover takes a non-misclick code path inside moveToTarget, so the
      // move count must be identical regardless of misclickProbability.
      async function hoverMoves(misclickProbability: number) {
        const { page, mouseMove } = makeMockPage();
        const human = await createHuman(page, {
          personality: { extends: 'careful', mouse: { misclickProbability } },
          speed: 'fast',
          seed: 'hover-seed',
        });
        await human.hover('button');
        return mouseMove.mock.calls.length;
      }

      const off = await hoverMoves(0);
      const on = await hoverMoves(1);
      expect(off).toBe(on);
    });

    it('drag with element-bound `from` fires the misclick beat before grabbing', async () => {
      // Element-bound `from` (selector / Locator) routes through
      // `pickMisclickOutsideBox` for the near-miss point. With prob 1, the
      // detour should produce substantially more moves than the baseline.
      async function dragMoves(misclickProbability: number) {
        const { page, mouseMove } = makeMockPage();
        const human = await createHuman(page, {
          personality: { extends: 'careful', mouse: { misclickProbability } },
          speed: 'fast',
          seed: 'drag-element-misclick',
        });
        await human.drag('source', 'target');
        return mouseMove.mock.calls.length;
      }

      const off = await dragMoves(0);
      const on = await dragMoves(1);
      expect(on).toBeGreaterThan(off * 1.3);
    });

    it('drag with raw-Point `from` fires the misclick beat around the point', async () => {
      // Raw-Point `from` (no element) routes through `pickMisclickAroundPoint`.
      // Same expected outcome: prob 1 produces more moves than prob 0.
      async function dragMoves(misclickProbability: number) {
        const { page, mouseMove } = makeMockPage();
        const human = await createHuman(page, {
          personality: { extends: 'careful', mouse: { misclickProbability } },
          speed: 'fast',
          seed: 'drag-point-misclick',
        });
        await human.drag({ x: 400, y: 300 }, { x: 800, y: 500 });
        return mouseMove.mock.calls.length;
      }

      const off = await dragMoves(0);
      const on = await dragMoves(1);
      expect(on).toBeGreaterThan(off * 1.3);
    });

    it('drag fires exactly one mousedown and one mouseup at the resolved endpoints', async () => {
      // No matter whether misclick fires, the drag boundaries (mousedown
      // at `from`, mouseup at `to`) commit exactly once at the resolved
      // coordinates — the misclick is visual cursor motion only.
      const { page } = makeMockPage();
      const mouseDown = page.mouse.down as ReturnType<typeof vi.fn>;
      const mouseUp = page.mouse.up as ReturnType<typeof vi.fn>;
      const human = await createHuman(page, {
        personality: { extends: 'careful', mouse: { misclickProbability: 1 } },
        speed: 'fast',
        seed: 'drag-commits-cleanly',
      });
      await human.drag('source', 'target');

      expect(mouseDown).toHaveBeenCalledTimes(1);
      expect(mouseUp).toHaveBeenCalledTimes(1);
    });

    it('skips the misclick beat when the cursor is already on the target', async () => {
      // Cursor starts inside the target box (default box is at 100,200,80,30
      // → center 140,215, well inside). A real user doesn't aim away from
      // a button they're already hovering, so the misclick beat should be
      // suppressed in this case — even at probability 1.
      async function clickMoves(misclickProbability: number) {
        const { page, mouseMove } = makeMockPage();
        const human = await createHuman(page, {
          personality: { extends: 'careful', mouse: { misclickProbability } },
          speed: 'fast',
          seed: 'cursor-already-on-target',
          initialMousePosition: { x: 140, y: 215 },
        });
        await human.click('button');
        return mouseMove.mock.calls.length;
      }

      const off = await clickMoves(0);
      const on = await clickMoves(1);
      // With cursor already inside, prob 1 must NOT add a detour.
      expect(on).toBe(off);
    });

    it("drag's `to` misclick keeps the drop coordinates exact", async () => {
      // With both endpoints rolling for misclick (prob 1 here), the drop
      // misclick wanders the cursor near `to` and dwells, then walks back
      // to the real drop coordinates. The contract that mouseup fires at
      // exactly `to` must still hold — visual-only safety, like the grab
      // side. Using raw Points so we know the exact resolved drop coords.
      const { page, mouseMove } = makeMockPage();
      const mouseUp = page.mouse.up as ReturnType<typeof vi.fn>;
      const human = await createHuman(page, {
        personality: { extends: 'careful', mouse: { misclickProbability: 1 } },
        speed: 'fast',
        seed: 'drag-to-misclick',
      });
      await human.drag({ x: 100, y: 100 }, { x: 500, y: 500 });

      // mouseup called exactly once — the misclick is visual-only.
      expect(mouseUp).toHaveBeenCalledTimes(1);

      // The last mouse.move before mouseup lands at the exact drop point.
      // If the to-endpoint misclick leaked into the actual drop coords, the
      // cursor would end somewhere 5–15 px off and this would fail.
      const lastMove = mouseMove.mock.calls.at(-1) as [number, number];
      expect(lastMove[0]).toBe(500);
      expect(lastMove[1]).toBe(500);
    });
  });

  describe('drag: curve-aware viewport pre-scroll', () => {
    // Default mock viewport: 1280×720. A long horizontal drag at y near
    // the bottom edge produces a Bezier curve whose perpendicular extent
    // pokes below the viewport — Chrome's native edge-scroll-during-drag
    // would fire on a real page. The library pre-scrolls just enough to
    // bring the worst-case curve bounding box back inside.

    it('pre-scrolls when an element×element drag would extrude past the viewport edge', async () => {
      // Two distinct endpoints near the viewport bottom (centers around
      // y=615 in a 720-tall viewport): individually in view, but the curve
      // from (90, 615) → (790, 615) at curvature 0.4 reaches ±280 px
      // perpendicular → maxY ≈ 895, well past the 720 bottom edge.
      let scrolled = false;
      const makeLowLocator = (x: number): MockLocator => {
        const lowBox: MockBoundingBox = { x, y: 600, width: 100, height: 30 };
        const liftedBox: MockBoundingBox = { x, y: 200, width: 100, height: 30 };
        return {
          boundingBox: vi.fn(() => Promise.resolve(scrolled ? liftedBox : lowBox)),
          click: vi.fn().mockResolvedValue(undefined),
          scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
        };
      };
      // Selector-keyed dispatch lets us pass plain selector strings to
      // `human.drag` without any `as unknown as Locator` cast.
      const fromLocator = makeLowLocator(40); // box [40, 600, 100, 30] → center (90, 615)
      const toLocator = makeLowLocator(740); // box [740, 600, 100, 30] → center (790, 615)

      const wheelCalls: Array<{ dx: number; dy: number }> = [];
      const page = {
        goto: vi.fn().mockResolvedValue(null),
        locator: vi.fn((selector: string) => (selector === 'source' ? fromLocator : toLocator)),
        evaluate: vi.fn().mockResolvedValue({ current: 0, viewport: 720, total: 2000 }),
        mouse: {
          move: vi.fn().mockResolvedValue(undefined),
          click: vi.fn().mockResolvedValue(undefined),
          wheel: vi.fn().mockImplementation((dx: number, dy: number) => {
            wheelCalls.push({ dx, dy });
            scrolled = true;
            return Promise.resolve();
          }),
          down: vi.fn().mockResolvedValue(undefined),
          up: vi.fn().mockResolvedValue(undefined),
        },
        viewportSize: () => ({ width: 1280, height: 720 }),
      } as unknown as Page;

      const human = await createHuman(page, {
        speed: 'fast',
        seed: 'curve-aware-drag',
        personality: { extends: 'careful', mouse: { misclickProbability: 0 } },
      });
      await human.drag('source', 'target');

      // Pre-scroll happened (wheel events were dispatched before the drag).
      expect(wheelCalls.length).toBeGreaterThan(0);
      // The page scrolled DOWN (positive dy) — moving elements UP in
      // viewport space to give the curve room below.
      const totalScroll = wheelCalls.reduce((sum, w) => sum + w.dy, 0);
      expect(totalScroll).toBeGreaterThan(0);
    });

    it('does NOT pre-scroll when one endpoint is a raw Point', async () => {
      // Raw-Point endpoints would shift relative to element endpoints
      // under a page scroll, changing the drag's geometry. The library
      // skips the curve-aware scroll in that case — the caller's
      // coordinates are honored as-is.
      const lowBox: MockBoundingBox = { x: 50, y: 600, width: 100, height: 30 };
      const locator: MockLocator = {
        boundingBox: vi.fn().mockResolvedValue(lowBox),
        click: vi.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      };
      const { page, mouseWheel } = makeMockPage(locator);
      const human = await createHuman(page, {
        speed: 'fast',
        seed: 'curve-aware-raw-point',
        personality: { extends: 'careful', mouse: { misclickProbability: 0 } },
      });

      // selector → raw Point. The library defers to the caller.
      await human.drag('source', { x: 750, y: 615 });

      expect(mouseWheel).not.toHaveBeenCalled();
    });

    it('does NOT pre-scroll when both endpoints are comfortably mid-viewport', async () => {
      // Default box at (100, 200, 80, 30): center around y=215, well
      // inside the 720-tall viewport with plenty of headroom above and
      // below. No curve-aware scroll needed.
      const { page, mouseWheel } = makeMockPage();
      const human = await createHuman(page, {
        speed: 'fast',
        seed: 'no-curve-scroll',
        personality: { extends: 'careful', mouse: { misclickProbability: 0 } },
      });
      await human.drag('source', 'target');

      expect(mouseWheel).not.toHaveBeenCalled();
    });
  });

  describe('drag: resolve-time raw-Point shift', () => {
    // The slider case: caller drags an element thumb to a raw `Point`
    // computed from the thumb's current y. When the library's auto-scroll
    // pulls the off-viewport thumb into view, the raw Point must shift by
    // the same delta so the drag's geometric relationship survives the
    // scroll — otherwise the cursor walks to a now-stale viewport-y and
    // triggers Chrome's edge-scroll-during-drag.

    it('shifts a raw Point `to` by the resolve-time auto-scroll delta', async () => {
      // Stateful mock: scrollY starts at 0, increments whenever wheel
      // fires. The locator returns a box below the fold while scrollY is
      // 0, then a centered box once any scroll has happened — modeling
      // `readBoxWithAutoScroll`'s effect on a previously off-viewport
      // element.
      let scrollY = 0;
      const offViewBox: MockBoundingBox = { x: 50, y: 900, width: 100, height: 30 };
      const inViewBox: MockBoundingBox = { x: 50, y: 350, width: 100, height: 30 };
      const locator: MockLocator = {
        boundingBox: vi.fn(() => Promise.resolve(scrollY > 0 ? inViewBox : offViewBox)),
        click: vi.fn().mockResolvedValue(undefined),
        scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
      };
      const moveCalls: Array<{ x: number; y: number }> = [];
      const page = {
        goto: vi.fn().mockResolvedValue(null),
        locator: vi.fn(() => locator),
        // Dispatch by function source: `executeScroll`'s geometry read
        // mentions `documentElement` (for `scrollHeight`); all other
        // `evaluate` calls in this drag path just read `window.scrollY`.
        evaluate: vi.fn((fn: () => unknown) => {
          if (fn.toString().includes('documentElement')) {
            return Promise.resolve({ current: scrollY, viewport: 720, total: 2000 });
          }
          return Promise.resolve(scrollY);
        }),
        mouse: {
          move: vi.fn((x: number, y: number) => {
            moveCalls.push({ x, y });
            return Promise.resolve();
          }),
          click: vi.fn().mockResolvedValue(undefined),
          wheel: vi.fn((_dx: number, dy: number) => {
            scrollY += dy;
            return Promise.resolve();
          }),
          down: vi.fn().mockResolvedValue(undefined),
          up: vi.fn().mockResolvedValue(undefined),
        },
        viewportSize: () => ({ width: 1280, height: 720 }),
      } as unknown as Page;

      const human = await createHuman(page, {
        speed: 'fast',
        seed: 'resolve-time-shift',
        personality: { extends: 'careful', mouse: { misclickProbability: 0 } },
      });

      // Caller-computed Point at the thumb's *pre-scroll* y — same shape
      // as `human.drag('#slider-thumb', { x, y: thumb.y + thumb.height/2 })`
      // in real code.
      const originalTargetY = 915;
      await human.drag('source', { x: 800, y: originalTargetY });

      // Auto-scroll fired during the element resolve.
      expect(scrollY).toBeGreaterThan(0);

      // The final cursor position (last `mouse.move` before `mouse.up`)
      // sits at `originalTargetY - scrollY`, not at the original Point.
      // That's the resolve-time shift: the raw `to` followed the page
      // scroll, keeping the drag horizontal relative to the now-centered
      // thumb.
      const finalMove = moveCalls.at(-1);
      expect(finalMove).toBeDefined();
      expect(finalMove?.y).toBe(originalTargetY - scrollY);
    });
  });
});
