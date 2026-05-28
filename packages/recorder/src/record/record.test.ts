import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fakes + mock fns, hoisted so the vi.mock factory below can use them.
const m = vi.hoisted(() => {
  const fakePage = { goto: vi.fn() };
  const fakeContext = { newPage: vi.fn(), pages: vi.fn(), close: vi.fn() };
  const fakeBrowser = { newContext: vi.fn(), contexts: vi.fn(), close: vi.fn() };
  const fakeRecording = { toVideo: vi.fn(), toGif: vi.fn(), toTimeline: vi.fn() };
  const fakeHuman = { record: vi.fn() };
  return {
    fakePage,
    fakeContext,
    fakeBrowser,
    fakeRecording,
    fakeHuman,
    launch: vi.fn(),
    launchPersistentContext: vi.fn(),
    connectOverCDP: vi.fn(),
    createHuman: vi.fn(),
    installMouseHelper: vi.fn(),
  };
});

vi.mock('@humanjs/playwright', () => ({
  chromium: {
    launch: m.launch,
    launchPersistentContext: m.launchPersistentContext,
    connectOverCDP: m.connectOverCDP,
  },
  createHuman: m.createHuman,
  installMouseHelper: m.installMouseHelper,
}));

import { record } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  m.fakePage.goto.mockResolvedValue(undefined);
  m.fakeContext.newPage.mockResolvedValue(m.fakePage);
  m.fakeContext.pages.mockReturnValue([m.fakePage]);
  m.fakeContext.close.mockResolvedValue(undefined);
  m.fakeBrowser.newContext.mockResolvedValue(m.fakeContext);
  m.fakeBrowser.contexts.mockReturnValue([m.fakeContext]);
  m.fakeBrowser.close.mockResolvedValue(undefined);
  m.launch.mockResolvedValue(m.fakeBrowser);
  m.launchPersistentContext.mockResolvedValue(m.fakeContext);
  m.connectOverCDP.mockResolvedValue(m.fakeBrowser);
  m.installMouseHelper.mockResolvedValue(undefined);
  // human.record runs the callback (so the user's fn is exercised) and
  // resolves with the fake Recording.
  m.fakeHuman.record.mockImplementation(async (_opts: unknown, cb: () => Promise<void>) => {
    await cb();
    return m.fakeRecording;
  });
  m.createHuman.mockResolvedValue(m.fakeHuman);
});

describe('record — ephemeral (default)', () => {
  it('launches a fresh browser + context and closes both on finish', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const rec = await record(fn);
    expect(rec).toBe(m.fakeRecording);
    expect(fn).toHaveBeenCalledWith(m.fakeHuman, m.fakePage);
    expect(m.launch).toHaveBeenCalledTimes(1);
    expect(m.fakeBrowser.newContext).toHaveBeenCalledTimes(1);
    expect(m.installMouseHelper).toHaveBeenCalledWith(m.fakeContext, undefined);
    expect(m.fakeContext.close).toHaveBeenCalled();
    expect(m.fakeBrowser.close).toHaveBeenCalled();
    expect(m.launchPersistentContext).not.toHaveBeenCalled();
    expect(m.connectOverCDP).not.toHaveBeenCalled();
  });

  it('forwards the channel to launch', async () => {
    await record({ channel: 'chrome' }, vi.fn().mockResolvedValue(undefined));
    expect(m.launch).toHaveBeenCalledWith(expect.objectContaining({ channel: 'chrome' }));
  });

  it('skips the cursor overlay when cursor:false', async () => {
    await record({ cursor: false }, vi.fn().mockResolvedValue(undefined));
    expect(m.installMouseHelper).not.toHaveBeenCalled();
  });

  it('exports to the output path (video vs gif by extension)', async () => {
    await record({ output: 'demo.mp4' }, vi.fn().mockResolvedValue(undefined));
    expect(m.fakeRecording.toVideo).toHaveBeenCalledWith('demo.mp4', { quality: 'high' });

    vi.clearAllMocks();
    m.fakeHuman.record.mockImplementation(async (_o: unknown, cb: () => Promise<void>) => {
      await cb();
      return m.fakeRecording;
    });
    m.createHuman.mockResolvedValue(m.fakeHuman);
    m.launch.mockResolvedValue(m.fakeBrowser);
    m.fakeBrowser.newContext.mockResolvedValue(m.fakeContext);
    m.fakeContext.newPage.mockResolvedValue(m.fakePage);
    await record({ output: 'demo.gif' }, vi.fn().mockResolvedValue(undefined));
    expect(m.fakeRecording.toGif).toHaveBeenCalledWith('demo.gif');
  });
});

describe('record — persistent profile (userDataDir)', () => {
  it('uses launchPersistentContext and closes that context (no separate browser)', async () => {
    await record({ userDataDir: '/profile' }, vi.fn().mockResolvedValue(undefined));
    expect(m.launchPersistentContext).toHaveBeenCalledWith('/profile', expect.any(Object));
    expect(m.launch).not.toHaveBeenCalled();
    expect(m.fakeContext.close).toHaveBeenCalled();
    expect(m.fakeBrowser.close).not.toHaveBeenCalled();
  });
});

describe('record — CDP attach (cdpUrl)', () => {
  it('connects over CDP, reuses the existing context, and NEVER closes it', async () => {
    await record({ cdpUrl: 'http://localhost:9222' }, vi.fn().mockResolvedValue(undefined));
    expect(m.connectOverCDP).toHaveBeenCalledWith('http://localhost:9222');
    expect(m.fakeBrowser.newContext).not.toHaveBeenCalled(); // reused contexts()[0]
    // Borrowed browser — leave it and its context untouched.
    expect(m.fakeContext.close).not.toHaveBeenCalled();
    expect(m.fakeBrowser.close).not.toHaveBeenCalled();
  });

  it('takes precedence over userDataDir', async () => {
    await record(
      { cdpUrl: 'http://localhost:9222', userDataDir: '/profile' },
      vi.fn().mockResolvedValue(undefined),
    );
    expect(m.connectOverCDP).toHaveBeenCalled();
    expect(m.launchPersistentContext).not.toHaveBeenCalled();
  });
});
