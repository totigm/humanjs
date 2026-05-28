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

import { join } from 'node:path';
import type { PersonalityConfig, PresetName } from '@humanjs/core';
import {
  createHuman,
  type Human,
  installMouseHelper,
  type Recording,
  type RecordingQuality,
} from '@humanjs/playwright';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';
import type { McpEnv } from './env';

export const DEFAULT_SESSION_ID = 'default';

/** Public-facing view of a session. */
export interface SessionInfo {
  readonly id: string;
  readonly personality: PresetName;
  readonly createdAt: number;
}

/** Options accepted by {@link SessionManager.create}. */
export interface CreateSessionOptions {
  readonly personality?: PresetName;
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
  readonly stop: () => void;
  readonly done: Promise<Recording>;
}

interface InternalSession {
  readonly id: string;
  readonly context: BrowserContext;
  readonly page: Page;
  human: Human;
  personality: PresetName;
  recording: RecordingState | null;
  readonly createdAt: number;
}

/**
 * Manages the shared browser process plus the registry of named sessions.
 * Construct once at server startup; pass the same instance to every tool
 * registration so tools can resolve sessions consistently.
 */
export class SessionManager {
  private browser: Browser | null = null;
  private readonly sessions = new Map<string, InternalSession>();
  private readonly env: McpEnv;

  constructor(env: McpEnv) {
    this.env = env;
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

    const browser = await this.ensureBrowser();
    const context = await browser.newContext();
    // Install the visible cursor overlay on the context (before any page
    // exists) so every page — including ones opened later by navigation —
    // renders the humanized cursor. This is the point of the MCP server:
    // the AI's actions should be watchable, and recordings need the cursor.
    await installMouseHelper(context);
    const page = await context.newPage();
    const personality = options.personality ?? this.env.personality;
    const human = await createHuman(page, { personality });

    const session: InternalSession = {
      id,
      context,
      page,
      human,
      personality,
      recording: null,
      createdAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
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
    const done = session.human.record(
      { video: options.video ?? true, quality: options.quality ?? 'high' },
      () => signal,
    );
    session.recording = { name: options.name ?? 'recording', startedAt: Date.now(), stop, done };
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
    session.human = await createHuman(session.page, { personality: session.personality });
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
    session.human = await createHuman(session.page, { personality });
    // `personality` on InternalSession tracks the *preset name* for the
    // SessionInfo view. When a non-preset PersonalityConfig is passed
    // (a custom blend), we lose the preset name — that's intentional;
    // the public info downgrades to whatever name the resolved
    // personality carries.
    session.personality = (session.human.personality.name ?? 'careful') as PresetName;
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
        await recording.toVideo(join(this.env.outputDir, `${rec.name}-${rec.startedAt}.mp4`));
      } catch {
        // Nothing more we can do during teardown; don't block the close.
      }
    }
    this.sessions.delete(id);
    await session.context.close();
  }

  /**
   * Closes every session and the shared browser process. Called from
   * the bin entry's shutdown handlers (SIGINT / SIGTERM / normal exit)
   * so the MCP client doesn't leak chrome processes when it disconnects.
   */
  async closeAll(): Promise<void> {
    for (const id of [...this.sessions.keys()]) {
      await this.close(id);
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    this.browser = await chromium.launch({ headless: this.env.headless });
    return this.browser;
  }
}

function toSessionInfo(session: InternalSession): SessionInfo {
  return {
    id: session.id,
    personality: session.personality,
    createdAt: session.createdAt,
  };
}
