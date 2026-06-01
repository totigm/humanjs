import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';
import { createHuman } from '../index';

const defaultBox = { x: 100, y: 200, width: 80, height: 30 };

interface MockLocatorOptions {
  readonly box?: { x: number; y: number; width: number; height: number } | null;
  readonly isChecked?: ReturnType<typeof vi.fn>;
  readonly selectOptionReturn?: string[];
}

function makeMock(opts: MockLocatorOptions = {}) {
  const locator = {
    boundingBox: vi.fn().mockResolvedValue(opts.box === undefined ? defaultBox : opts.box),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    isChecked: opts.isChecked ?? vi.fn().mockResolvedValue(false),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(opts.selectOptionReturn ?? ['a']),
    setInputFiles: vi.fn().mockResolvedValue(undefined),
  };
  const mouseMove = vi.fn().mockResolvedValue(undefined);
  const mouseClick = vi.fn().mockResolvedValue(undefined);
  const page = {
    locator: vi.fn(() => locator),
    evaluate: vi.fn().mockResolvedValue(0),
    mouse: {
      move: mouseMove,
      click: mouseClick,
      wheel: vi.fn().mockResolvedValue(undefined),
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
    },
    viewportSize: () => ({ width: 1280, height: 720 }),
  } as unknown as Page;
  return { page, locator, mouseMove, mouseClick };
}

describe('human.check / uncheck', () => {
  it('clicks to tick an unchecked box and verifies the new state', async () => {
    const isChecked = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { page, mouseClick } = makeMock({ isChecked });
    const human = await createHuman(page, { speed: 'fast' });
    await human.check('#agree');
    expect(mouseClick).toHaveBeenCalledTimes(1);
  });

  it('does not click when the box is already in the desired state', async () => {
    const isChecked = vi.fn().mockResolvedValue(true);
    const { page, mouseClick } = makeMock({ isChecked });
    const human = await createHuman(page, { speed: 'fast' });
    await human.check('#agree');
    expect(mouseClick).not.toHaveBeenCalled();
  });

  it('throws when the state does not change after clicking', async () => {
    const isChecked = vi.fn().mockResolvedValue(false); // stays false after click
    const { page } = makeMock({ isChecked });
    const human = await createHuman(page, { speed: 'fast' });
    await expect(human.check('#radio')).rejects.toThrow(/did not reach the checked state/);
  });

  it('still toggles when the element is not directly checkable (label/role)', async () => {
    // isChecked throws → readChecked returns null → click fires, no verify
    const isChecked = vi.fn().mockRejectedValue(new Error('not a checkbox'));
    const { page, mouseClick } = makeMock({ isChecked });
    const human = await createHuman(page, { speed: 'fast' });
    await human.check('label.toggle');
    expect(mouseClick).toHaveBeenCalledTimes(1);
  });

  it('uncheck clicks a checked box', async () => {
    const isChecked = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const { page, mouseClick } = makeMock({ isChecked });
    const human = await createHuman(page, { speed: 'fast' });
    await human.uncheck('#agree');
    expect(mouseClick).toHaveBeenCalledTimes(1);
  });

  it('instant mode delegates to native check()/uncheck()', async () => {
    const { page, locator, mouseClick } = makeMock();
    const human = await createHuman(page, { speed: 'instant' });
    await human.check('#a');
    await human.uncheck('#b');
    expect(locator.check).toHaveBeenCalledTimes(1);
    expect(locator.uncheck).toHaveBeenCalledTimes(1);
    expect(mouseClick).not.toHaveBeenCalled();
  });
});

describe('human.selectOption', () => {
  it('moves the cursor to the select, then sets the value', async () => {
    const { page, locator, mouseMove } = makeMock({ selectOptionReturn: ['AR'] });
    const human = await createHuman(page, { speed: 'fast' });
    const selected = await human.selectOption('#country', 'AR');
    expect(mouseMove).toHaveBeenCalled(); // humanized approach
    expect(locator.selectOption).toHaveBeenCalledWith('AR');
    expect(selected).toEqual(['AR']);
  });

  it('instant mode sets the value with no cursor motion', async () => {
    const { page, locator, mouseMove } = makeMock();
    const human = await createHuman(page, { speed: 'instant' });
    await human.selectOption('#country', ['a', 'b']);
    expect(locator.selectOption).toHaveBeenCalledWith(['a', 'b']);
    expect(mouseMove).not.toHaveBeenCalled();
  });
});

describe('human.upload', () => {
  it('moves to the control, then attaches the files', async () => {
    const { page, locator, mouseMove } = makeMock();
    const human = await createHuman(page, { speed: 'fast' });
    await human.upload('#file', '/tmp/a.png');
    expect(mouseMove).toHaveBeenCalled();
    expect(locator.setInputFiles).toHaveBeenCalledWith('/tmp/a.png');
  });

  it('tolerates a hidden file input (no bounding box) and still attaches', async () => {
    const { page, locator } = makeMock({ box: null });
    const human = await createHuman(page, { speed: 'fast' });
    await human.upload('#hidden-file', ['/tmp/a.png', '/tmp/b.png']);
    expect(locator.setInputFiles).toHaveBeenCalledWith(['/tmp/a.png', '/tmp/b.png']);
  });

  it('instant mode attaches with no cursor motion', async () => {
    const { page, locator, mouseMove } = makeMock();
    const human = await createHuman(page, { speed: 'instant' });
    await human.upload('#file', '/tmp/a.png');
    expect(locator.setInputFiles).toHaveBeenCalledWith('/tmp/a.png');
    expect(mouseMove).not.toHaveBeenCalled();
  });
});

describe('human.doubleClick', () => {
  it('dispatches a double-click after the humanized approach', async () => {
    const { page, mouseClick } = makeMock();
    const human = await createHuman(page, { speed: 'fast' });
    await human.doubleClick('#row');
    expect(mouseClick).toHaveBeenCalledTimes(1);
    const [, , opts] = mouseClick.mock.calls[0] ?? [];
    expect(opts).toMatchObject({ clickCount: 2 });
  });

  it('instant mode uses locator.click with clickCount 2', async () => {
    const { page, locator } = makeMock();
    const human = await createHuman(page, { speed: 'instant' });
    await human.doubleClick('#row');
    expect(locator.click).toHaveBeenCalledWith(expect.objectContaining({ clickCount: 2 }));
  });
});
