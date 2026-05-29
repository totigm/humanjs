/**
 * Browser session management for `@humanjs/mcp`.
 *
 * One `Browser` process backs the whole MCP server. Each named session
 * gets its own `BrowserContext` + `Page` + `Human` instance so sessions
 * are isolated (cookies, storage, viewport) without paying the cost of
 * a separate browser per session.
 *
 * The default session (`'default'`) is created lazily on first tool call
 * — clients that don't care about multi-session never see session IDs in
 * their tool args. Explicit sessions land via `human_create_session`.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import type { PersonalityConfig, PresetName } from '@humanjs/core';
import {
  createHuman,
  type Human,
  installMouseHelper,
  type Recording,
  type RecordingQuality,
  type Speed,
} from '@humanjs/playwright';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';
import { type BrowserConfig, DEFAULT_PERSIST_DIR, type McpEnv } from './env';

export const DEFAULT_SESSION_ID = 'default';

/** Public-facing view of a session. */
export interface SessionInfo {
  readonly id: string;
  readonly personality: PresetName;
  readonly speed: Speed;
  readonly createdAt: number;
}

/** Options accepted by {@link SessionManager.create}. */
export interface CreateSessionOptions {
  readonly personality?: PresetName;
  readonly speed?: Speed;
  readonly viewport?: { readonly width: number; readonly height: number };
}

/** Options accepted by {@link SessionManager.startRecording}. */
export interface StartRecordingOptions {
  readonly name?: string;
  readonly video?: boolean;
  readonly quality?: RecordingQuality;
}

/**
 * Open-recording state held on a session. `human.record(fn)` is
 * callback-based, but MCP actions arrive as independent tool calls — so we
 * keep the callback alive by having it await `stop()`'s signal. Capture
 * (frames + timeline) runs the whole time; `done` resolves with the
 * finished `Recording` once `stop()` fires.
 */
interface RecordingState {
  readonly name: string;
  readonly startedAt: number;
  /** Whether video frames are being captured (false = timeline-only). */
  readonly video: boolean;
  readonly stop: () => void;
  readonly done: Promise<Recording>;
}

type BrowserMode = 'cdp' | 'persistent' | 'ephemeral';

interface InternalSession {
  readonly id: string;
  readonly context: BrowserContext;
  readonly page: Page;
  human: Human;
  personality: PresetName;
  speed: Speed;
  /** The browser mode this session was created under (drives cleanup). */
  readonly mode: BrowserMode;
  recording: RecordingState | null;
  readonly createdAt: number;
}

/** Read-only snapshot of how the browser is (or will be) obtained. */
export interface BrowserInfo {
  readonly mode: BrowserMode;
  readonly userDataDir: string | null;
  readonly cdpUrl: string | null;
  readonly channel: string | null;
  /** True when a persistence toggle is set but a restart is needed to apply it. */
  readonly persistPendingRestart: boolean;
  readonly browserRunning: boolean;
}

/**
 * Manages the shared browser process plus the registry of named sessions.
 * Construct once at server startup; pass the same instance to every tool
 * registration so tools can resolve sessions consistently.
 */
export class SessionManager {
  /** Backing browser for `ephemeral` and `cdp` modes. */
  private browser: Browser | null = null;
  /** Backing context for `persistent` mode (launchPersistentContext returns a context, no Browser). */
  private persistentContext: BrowserContext | null = null;
  /** True when `browser` was obtained via connectOverCDP — must NOT be closed on teardown. */
  private cdpConnected = false;
  /** Runtime persistence toggle (from human_enable_persistence); overrides env mode on next launch. */
  private persistOverride: { userDataDir: string } | null = null;
  private readonly sessions = new Map<string, InternalSession>();
  private readonly env: McpEnv;

  constructor(env: McpEnv) {
    this.env = env;
  }

  /** Effective browser config, honoring the runtime persistence override. */
  private effectiveConfig(): BrowserConfig {
    if (this.persistOverride) {
      return { mode: 'persistent', userDataDir: this.persistOverride.userDataDir };
    }
    return this.env.browser;
  }

  /**
   * Resolves the session named by `id`, creating the default session
   * lazily if `id` is omitted or `'default'` and the session doesn't
   * exist yet. Throws if an explicit non-default session ID hasn't been
   * created — that case is a caller bug, not a missing-default UX
   * problem, and a clear error helps the AI agent recover.
   */
  async get(id: string = DEFAULT_SESSION_ID): Promise<InternalSession> {
    const existing = this.sessions.get(id);
    if (existing) return existing;
    if (id === DEFAULT_SESSION_ID) return this.create(DEFAULT_SESSION_ID, {});
    throw new Error(
      `Session "${id}" does not exist. Use human_create_session to create it first, or omit the session argument to use the default session.`,
    );
  }

  /**
   * Creates a new named session. Throws if the ID is already in use —
   * the caller (an AI agent) should close the old one first if they
   * want to recreate.
   */
  async create(id: string, options: CreateSessionOptions): Promise<InternalSession> {
    if (this.sessions.has(id)) {
      throw new Error(
        `Session "${id}" already exists. Close it first with human_close_session if you want to recreate it.`,
      );
    }

    const config = this.effectiveConfig();
    if (config.mode !== 'ephemeral' && id !== DEFAULT_SESSION_ID) {
      throw new Error(
        `In ${config.mode} mode HumanJS drives a single shared browser, so named/parallel sessions aren't available. Omit the session argument to use the default session.`,
      );
    }

    const viewport = options.viewport ?? this.env.viewport;
    const { context, page } = await this.acquireContext(config, viewport);
    const personality = options.personality ?? this.env.personality;
    const speed = options.speed ?? this.env.speed;
    const human = await createHuman(page, { personality, speed });

    const session: InternalSession = {
      id,
      context,
      page,
      human,
      personality,
      speed,
      mode: config.mode,
      recording: null,
      createdAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Obtains a `{ context, page }` for the given mode:
   *
   * - `cdp` — reuse the attached browser's existing context + page (the
   *   user's real session); only make a new one if there's none.
   * - `persistent` — the single persistent context; reuse its page.
   * - `ephemeral` — a fresh isolated context + page per session.
   *
   * The visible cursor overlay is installed on the context in every mode.
   */
  private async acquireContext(
    config: BrowserConfig,
    viewport: { width: number; height: number },
  ): Promise<{ context: BrowserContext; page: Page }> {
    if (config.mode === 'cdp') {
      const browser = await this.ensureCdpBrowser(config.cdpUrl);
      const context = browser.contexts()[0] ?? (await browser.newContext());
      await installMouseHelper(context);
      const page = context.pages()[0] ?? (await context.newPage());
      return { context, page };
    }
    if (config.mode === 'persistent') {
      const context = await this.ensurePersistentContext(config.userDataDir, viewport);
      const page = context.pages()[0] ?? (await context.newPage());
      return { context, page };
    }
    const browser = await this.ensureEphemeralBrowser();
    const context = await browser.newContext({ viewport });
    // Install the visible cursor overlay before any page exists so every
    // page (including ones opened later by navigation) shows the cursor.
    await installMouseHelper(context);
    const page = await context.newPage();
    return { context, page };
  }

  /**
   * Starts a recording on a session. Holds `human.record()` open across
   * tool calls by awaiting an internal stop-signal — capture (frames +
   * action timeline) runs until {@link stopRecording} fires it.
   */
  async startRecording(id: string | undefined, options: StartRecordingOptions): Promise<void> {
    const session = await this.get(id);
    if (session.recording) {
      throw new Error(
        `Session "${session.id}" is already recording. Stop it first with human_stop_recording.`,
      );
    }
    let stop!: () => void;
    const signal = new Promise<void>((resolve) => {
      stop = resolve;
    });
    const video = options.video ?? true;
    const done = session.human.record(
      { name: options.name, video, quality: options.quality ?? 'high' },
      () => signal,
    );
    session.recording = {
      name: options.name ?? 'recording',
      startedAt: Date.now(),
      video,
      stop,
      done,
    };
  }

  /**
   * Stops the active recording, returns the finished {@link Recording} for
   * export, and recreates the session's `Human` so it can record again
   * (`human.record()` is single-use per instance; page/context/cookies are
   * preserved).
   */
  async stopRecording(id?: string): Promise<Recording> {
    const session = await this.get(id);
    const rec = session.recording;
    if (!rec) {
      throw new Error(
        `Session "${session.id}" is not recording. Start one with human_start_recording first.`,
      );
    }
    rec.stop();
    const recording = await rec.done;
    session.recording = null;
    session.human = await createHuman(session.page, {
      personality: session.personality,
      speed: session.speed,
    });
    return recording;
  }

  /**
   * Replaces the `Human` instance on an existing session with one bound
   * to a new personality. Browser context, page, cookies, and scroll
   * position are preserved — only the humanization profile changes.
   */
  async setPersonality(
    id: string = DEFAULT_SESSION_ID,
    personality: PersonalityConfig,
  ): Promise<SessionInfo> {
    const session = await this.get(id);
    assertNotRecording(session, 'change personality');
    session.human = await createHuman(session.page, { personality, speed: session.speed });
    // `personality` on InternalSession tracks the *preset name* for the
    // SessionInfo view. When a non-preset PersonalityConfig is passed
    // (a custom blend), we lose the preset name — that's intentional;
    // the public info downgrades to whatever name the resolved
    // personality carries.
    session.personality = (session.human.personality.name ?? 'careful') as PresetName;
    return toSessionInfo(session);
  }

  /**
   * Changes the humanization pace for a session at runtime. Recreates the
   * `Human` (speed is fixed at creation); browser context, page, cookies,
   * and scroll position are preserved.
   */
  async setSpeed(id: string = DEFAULT_SESSION_ID, speed: Speed): Promise<SessionInfo> {
    const session = await this.get(id);
    assertNotRecording(session, 'change speed');
    session.speed = speed;
    session.human = await createHuman(session.page, {
      personality: session.personality,
      speed,
    });
    return toSessionInfo(session);
  }

  /** Lists all currently-open sessions, including the default if active. */
  list(): SessionInfo[] {
    return [...this.sessions.values()].map(toSessionInfo);
  }

  /** Closes a single session and frees its browser context. */
  async close(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;
    // Graceful finalize: if a recording is open, stop and save it to a
    // default-named file so an in-progress clip isn't silently dropped on
    // disconnect. Best-effort — on a hard crash this never runs, and the
    // captured frames are left in the OS temp dir (swept by the recorder's
    // own exit handler / OS tmp cleanup).
    if (session.recording) {
      const rec = session.recording;
      session.recording = null;
      try {
        rec.stop();
        const recording = await rec.done;
        // Save video when frames were captured, else the JSON timeline —
        // toVideo() would throw on a timeline-only recording, losing it.
        // basename() keeps the AI-supplied name from escaping outputDir,
        // matching the policy resolveOutputPath enforces elsewhere.
        const ext = rec.video ? '.mp4' : '.json';
        const path = join(this.env.outputDir, basename(`${rec.name}-${rec.startedAt}${ext}`));
        if (rec.video) await recording.toVideo(path);
        else await recording.toTimeline(path);
      } catch {
        // Nothing more we can do during teardown; don't block the close.
      }
    }
    this.sessions.delete(id);
    // Mode-aware teardown. Ephemeral contexts are ours to close. The
    // persistent context owns its browser, so closing it shuts that down.
    // In CDP mode we attached to the user's running browser — never close
    // their context or browser; just drop our reference on closeAll.
    if (session.mode === 'ephemeral') {
      await session.context.close();
    } else if (session.mode === 'persistent') {
      await this.persistentContext?.close();
      this.persistentContext = null;
    }
  }

  /**
   * Tears down every session and the backing browser. Called from the bin
   * entry's shutdown handlers (SIGINT / SIGTERM) so we don't leak chrome
   * processes — and by {@link restartBrowser}. A CDP-attached browser is
   * never closed (it's the user's), only disconnected by dropping the ref.
   */
  async closeAll(): Promise<void> {
    for (const id of [...this.sessions.keys()]) {
      await this.close(id);
    }
    if (this.browser && !this.cdpConnected) {
      await this.browser.close();
    }
    this.browser = null;
    this.cdpConnected = false;
    this.persistentContext = null;
  }

  /**
   * Tears the browser down so the next action relaunches it in the current
   * (possibly newly-toggled) mode. Backs `human_restart_browser` — the way
   * to apply a persistence change without restarting the whole MCP server.
   * Discards open pages/tabs.
   */
  async restartBrowser(): Promise<void> {
    await this.closeAll();
  }

  /**
   * Turns on a persistent profile for subsequent browser starts (backs
   * `human_enable_persistence`). Takes effect on the next browser launch —
   * call {@link restartBrowser} to apply it to an already-running browser.
   */
  setPersistOverride(userDataDir?: string): void {
    this.persistOverride = { userDataDir: userDataDir ?? DEFAULT_PERSIST_DIR };
  }

  /** Read-only snapshot of the browser configuration (backs `human_browser_info`). */
  browserInfo(): BrowserInfo {
    const config = this.effectiveConfig();
    const running = this.browserRunning();
    return {
      mode: config.mode,
      userDataDir: config.mode === 'persistent' ? config.userDataDir : null,
      cdpUrl: config.mode === 'cdp' ? config.cdpUrl : null,
      channel: this.env.channel ?? null,
      // A toggle is "pending restart" only when a browser is already up:
      // before any browser exists, the new mode just applies on next start.
      persistPendingRestart: this.persistOverride !== null && running,
      browserRunning: running,
    };
  }

  private browserRunning(): boolean {
    return this.browser !== null || this.persistentContext !== null;
  }

  private async ensureEphemeralBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    this.browser = await this.withBrowserInstall(() =>
      chromium.launch({ headless: this.env.headless, channel: this.env.channel }),
    );
    return this.browser;
  }

  private async ensureCdpBrowser(url: string): Promise<Browser> {
    if (this.browser) return this.browser;
    try {
      this.browser = await chromium.connectOverCDP(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not attach to a browser at ${url} (HUMANJS_CDP_URL). Start your browser with ` +
          `--remote-debugging-port and a matching URL, then retry. (${message})`,
      );
    }
    this.cdpConnected = true;
    return this.browser;
  }

  private async ensurePersistentContext(
    userDataDir: string,
    viewport: { width: number; height: number },
  ): Promise<BrowserContext> {
    if (this.persistentContext) return this.persistentContext;
    this.persistentContext = await this.withBrowserInstall(() =>
      chromium.launchPersistentContext(userDataDir, {
        headless: this.env.headless,
        channel: this.env.channel,
        viewport,
      }),
    );
    await installMouseHelper(this.persistentContext);
    return this.persistentContext;
  }

  /**
   * Runs a browser-launch thunk, auto-installing Chromium once and retrying
   * if the binary is missing (the common first-run failure — binaries can't
   * ship via npm). Honors `HUMANJS_AUTO_INSTALL=false`. CDP attach doesn't
   * need a local binary, so it doesn't go through here.
   */
  private async withBrowserInstall<T>(launch: () => Promise<T>): Promise<T> {
    try {
      return await launch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/executable doesn't exist|playwright install/i.test(message)) throw error;

      if (!this.env.autoInstall) {
        throw new Error(
          "Chromium isn't installed and HUMANJS_AUTO_INSTALL is off. Run " +
            '`npx playwright install chromium` once, then retry.',
        );
      }

      await installChromium();
      try {
        return await launch();
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        throw new Error(
          'Auto-install of Chromium ran but the browser still failed to launch. ' +
            'Try `npx playwright install chromium` manually. ' +
            `(Original error: ${retryMessage})`,
        );
      }
    }
  }
}

/**
 * Downloads the Chromium browser binary via Playwright's own CLI. Resolves
 * the CLI from the bundled `playwright` dependency (not a global `npx`, so
 * the version matches) and runs `<cli> install chromium`.
 *
 * Child stdout/stderr are both routed to *our* stderr (fd 2) — never stdout,
 * which is reserved for the MCP JSON-RPC stream and would be corrupted by
 * the installer's progress output.
 */
async function installChromium(): Promise<void> {
  process.stderr.write(
    '[humanjs-mcp] Chromium not found — installing once (~150MB, may take a minute)…\n',
  );
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('playwright/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { bin?: { playwright?: string } };
  const binRel = pkg.bin?.playwright;
  if (!binRel) {
    throw new Error("Could not locate Playwright's CLI to install Chromium.");
  }
  const cli = join(dirname(pkgPath), binRel);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {
      stdio: ['ignore', 2, 2],
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`playwright install exited with code ${code}.`));
    });
  });
  process.stderr.write('[humanjs-mcp] Chromium installed.\n');
}

function toSessionInfo(session: InternalSession): SessionInfo {
  return {
    id: session.id,
    personality: session.personality,
    speed: session.speed,
    createdAt: session.createdAt,
  };
}

/**
 * Guards operations that recreate the `Human` (personality / speed changes)
 * against an in-flight recording — the recording holds the *old* `Human`'s
 * `record()` call open, so swapping in a new instance would silently stop
 * capturing subsequent actions.
 */
function assertNotRecording(session: InternalSession, action: string): void {
  if (session.recording) {
    throw new Error(
      `Cannot ${action} while session "${session.id}" is recording. Stop the recording first with human_stop_recording.`,
    );
  }
}
