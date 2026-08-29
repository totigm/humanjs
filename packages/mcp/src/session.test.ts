import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserConfig, McpEnv } from './env';

// Fakes + mock fns, hoisted so the vi.mock factories below can use them.
const m = vi.hoisted(() => {
  const fakePage = { on: vi.fn() };
  const fakeContext = { newPage: vi.fn(), pages: vi.fn(), close: vi.fn() };
  const fakeBrowser = { newContext: vi.fn(), contexts: vi.fn(), close: vi.fn() };
  return {
    fakePage,
    fakeContext,
    fakeBrowser,
    launch: vi.fn(),
    launchPersistentContext: vi.fn(),
    connectOverCDP: vi.fn(),
    createHuman: vi.fn(),
    installMouseHelper: vi.fn(),
  };
});

vi.mock('playwright', () => ({
  chromium: {
    launch: m.launch,
    launchPersistentContext: m.launchPersistentContext,
    connectOverCDP: m.connectOverCDP,
  },
}));

vi.mock('@humanjs/playwright', () => ({
  createHuman: m.createHuman,
  installMouseHelper: m.installMouseHelper,
}));

import { SessionManager } from './session';

function makeEnv(browser: BrowserConfig = { mode: 'ephemeral' }, channel?: string): McpEnv {
  return {
    personality: 'careful',
    speed: 'human',
    headless: true,
    outputDir: '/tmp/out',
    uploadDir: '/tmp/uploads',
    viewport: { width: 1440, height: 900 },
    autoInstall: true,
    browser,
    channel,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.fakeContext.newPage.mockResolvedValue(m.fakePage);
  m.fakeContext.pages.mockReturnValue([m.fakePage]);
  m.fakeContext.close.mockResolvedValue(undefined);
  m.fakeBrowser.newContext.mockResolvedValue(m.fakeContext);
  m.fakeBrowser.contexts.mockReturnValue([m.fakeContext]);
  m.fakeBrowser.close.mockResolvedValue(undefined);
  m.launch.mockResolvedValue(m.fakeBrowser);
  m.launchPersistentContext.mockResolvedValue(m.fakeContext);
  m.connectOverCDP.mockResolvedValue(m.fakeBrowser);
  m.createHuman.mockResolvedValue({ personality: { name: 'careful' } });
  m.installMouseHelper.mockResolvedValue(undefined);
});

describe('SessionManager — ephemeral (default)', () => {
  it('lazily creates the default session on first get(), launching a browser', async () => {
    const mgr = new SessionManager(makeEnv());
    const session = await mgr.get();
    expect(session.id).toBe('default');
    expect(session.mode).toBe('ephemeral');
    expect(m.launch).toHaveBeenCalledTimes(1);
    expect(m.fakeBrowser.newContext).toHaveBeenCalledTimes(1);
    expect(m.installMouseHelper).toHaveBeenCalledWith(m.fakeContext);
  });

  it('reuses the default session (launches once)', async () => {
    const mgr = new SessionManager(makeEnv());
    const a = await mgr.get();
    const b = await mgr.get();
    expect(a).toBe(b);
    expect(m.launch).toHaveBeenCalledTimes(1);
  });

  it('supports multiple named sessions (a context each)', async () => {
    const mgr = new SessionManager(makeEnv());
    await mgr.get();
    await mgr.create('two', {});
    expect(
      mgr
        .list()
        .map((s) => s.id)
        .sort(),
    ).toEqual(['default', 'two']);
    expect(m.fakeBrowser.newContext).toHaveBeenCalledTimes(2);
  });

  it('throws for an unknown non-default session', async () => {
    const mgr = new SessionManager(makeEnv());
    await expect(mgr.get('ghost')).rejects.toThrow(/does not exist/i);
  });

  it('closeAll closes contexts and the browser', async () => {
    const mgr = new SessionManager(makeEnv());
    await mgr.get();
    await mgr.closeAll();
    expect(m.fakeContext.close).toHaveBeenCalled();
    expect(m.fakeBrowser.close).toHaveBeenCalledTimes(1);
  });
});

describe('SessionManager — persistent', () => {
  const env = () => makeEnv({ mode: 'persistent', userDataDir: '/profile' });

  it('uses launchPersistentContext, not launch', async () => {
    const mgr = new SessionManager(env());
    const s = await mgr.get();
    expect(s.mode).toBe('persistent');
    expect(m.launchPersistentContext).toHaveBeenCalledWith('/profile', expect.any(Object));
    expect(m.launch).not.toHaveBeenCalled();
  });

  it('rejects a second named session (single shared browser)', async () => {
    const mgr = new SessionManager(env());
    await mgr.get();
    await expect(mgr.create('two', {})).rejects.toThrow(/single shared browser/i);
  });

  it('closeAll closes the persistent context but not a (nonexistent) browser', async () => {
    const mgr = new SessionManager(env());
    await mgr.get();
    await mgr.closeAll();
    expect(m.fakeContext.close).toHaveBeenCalled();
    expect(m.fakeBrowser.close).not.toHaveBeenCalled();
  });
});

describe('SessionManager — CDP attach', () => {
  const env = () => makeEnv({ mode: 'cdp', cdpUrl: 'http://localhost:9222' });

  it('connects over CDP and reuses the existing context', async () => {
    const mgr = new SessionManager(env());
    const s = await mgr.get();
    expect(s.mode).toBe('cdp');
    expect(m.connectOverCDP).toHaveBeenCalledWith('http://localhost:9222');
    expect(m.fakeBrowser.newContext).not.toHaveBeenCalled(); // reused contexts()[0]
  });

  it('NEVER closes the attached browser on teardown', async () => {
    const mgr = new SessionManager(env());
    await mgr.get();
    await mgr.closeAll();
    expect(m.fakeBrowser.close).not.toHaveBeenCalled();
    expect(m.fakeContext.close).not.toHaveBeenCalled();
  });
});

describe('SessionManager — runtime persistence override', () => {
  it('flips effective mode to persistent and reports it via browserInfo', async () => {
    const mgr = new SessionManager(makeEnv());
    expect(mgr.browserInfo().mode).toBe('ephemeral');
    mgr.setPersistOverride('/runtime-profile');
    const info = mgr.browserInfo();
    expect(info.mode).toBe('persistent');
    expect(info.userDataDir).toBe('/runtime-profile');
  });

  it('applies the override on the next browser start', async () => {
    const mgr = new SessionManager(makeEnv());
    mgr.setPersistOverride('/runtime-profile');
    const s = await mgr.get();
    expect(s.mode).toBe('persistent');
    expect(m.launchPersistentContext).toHaveBeenCalledWith('/runtime-profile', expect.any(Object));
  });
});

describe('SessionManager — observability', () => {
  it('gives every session its own console and network buffers', async () => {
    const mgr = new SessionManager(makeEnv());
    const session = await mgr.get();
    expect(session.observers.console.size).toBe(0);
    expect(session.observers.network.size).toBe(0);
  });

  it('subscribes to the page events the inspection tools read from', async () => {
    const mgr = new SessionManager(makeEnv());
    await mgr.get();
    const events = m.fakePage.on.mock.calls.map((call) => call[0]);
    // pageerror matters as much as console: an uncaught exception never
    // arrives as a console message, and it is the most useful signal.
    expect(events).toEqual(
      expect.arrayContaining(['console', 'pageerror', 'request', 'response', 'requestfailed']),
    );
  });
});
