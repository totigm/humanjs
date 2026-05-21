import type { BrowserContext, Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { installMouseHelper } from './index';

function makeMockPage(): {
  page: Page;
  addInitScript: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
} {
  const addInitScript = vi.fn().mockResolvedValue(undefined);
  const evaluate = vi.fn().mockResolvedValue(undefined);
  return { page: { addInitScript, evaluate } as unknown as Page, addInitScript, evaluate };
}

function makeMockContext(pageCount = 0): {
  context: BrowserContext;
  addInitScript: ReturnType<typeof vi.fn>;
  pageEvaluates: ReturnType<typeof vi.fn>[];
} {
  const addInitScript = vi.fn().mockResolvedValue(undefined);
  const pageEvaluates = Array.from({ length: pageCount }, () =>
    vi.fn().mockResolvedValue(undefined),
  );
  const pagesArray = pageEvaluates.map((evaluate) => ({ evaluate }) as unknown as Page);
  return {
    context: {
      addInitScript,
      pages: () => pagesArray,
    } as unknown as BrowserContext,
    addInitScript,
    pageEvaluates,
  };
}

describe('installMouseHelper', () => {
  it('calls addInitScript exactly once on the page', async () => {
    const { page, addInitScript } = makeMockPage();
    await installMouseHelper(page);
    expect(addInitScript).toHaveBeenCalledTimes(1);
  });

  it('passes the helper script as the first argument and config as the second', async () => {
    const { page, addInitScript } = makeMockPage();
    await installMouseHelper(page);
    const [script, config] = addInitScript.mock.calls[0] ?? [];
    expect(typeof script).toBe('function');
    expect(config).toBeDefined();
  });

  it('defaults config to HumanJS amber + size 22 + showClicks + a soft halo', async () => {
    const { page, addInitScript } = makeMockPage();
    await installMouseHelper(page);
    const [, config] = addInitScript.mock.calls[0] ?? [];
    expect(config.color).toBe('#f5a55c');
    expect(config.size).toBe(22);
    expect(config.showClicks).toBe(true);
    expect(config.haloOpacity).toBeGreaterThan(0);
    // The cursor path mirrors the canonical web `HumanCursorIcon` shape;
    // verifying the leading move keeps the two in lockstep.
    expect(config.path.startsWith('M 0 0')).toBe(true);
  });

  it('forwards user options into the serialized config', async () => {
    const { page, addInitScript } = makeMockPage();
    await installMouseHelper(page, {
      color: '#ffffff',
      size: 30,
      showClicks: false,
      haloOpacity: 0.4,
    });
    const [, config] = addInitScript.mock.calls[0] ?? [];
    expect(config.color).toBe('#ffffff');
    expect(config.size).toBe(30);
    expect(config.showClicks).toBe(false);
    expect(config.haloOpacity).toBe(0.4);
  });

  it('accepts a BrowserContext as the target', async () => {
    const { context, addInitScript } = makeMockContext();
    await installMouseHelper(context);
    expect(addInitScript).toHaveBeenCalledTimes(1);
  });

  it('also evaluates immediately on every existing page in a context', async () => {
    const { context, pageEvaluates } = makeMockContext(2);
    await installMouseHelper(context);
    for (const evaluate of pageEvaluates) {
      expect(evaluate).toHaveBeenCalledTimes(1);
    }
  });

  it('also evaluates immediately on a Page target so already-loaded content shows the cursor', async () => {
    const { page, evaluate } = makeMockPage();
    await installMouseHelper(page);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});
