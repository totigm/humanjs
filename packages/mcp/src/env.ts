/**
 * Environment-variable configuration for `@humanjs/mcp`. Every option is
 * read once at startup; runtime changes don't take effect until the MCP
 * server restarts. The `set_personality` tool is the one exception —
 * personality can flip per-session at runtime.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PresetName } from '@humanjs/core';
import type { Speed } from '@humanjs/playwright';

const VALID_PRESETS: readonly PresetName[] = ['careful', 'fast', 'distracted', 'precise'] as const;
const VALID_SPEEDS: readonly Speed[] = ['human', 'fast', 'instant'] as const;

export interface McpEnv {
  /**
   * Default personality applied to every new session. Per-session overrides
   * (via `human_create_session({ personality })`) and runtime changes
   * (via `human_set_personality`) take precedence.
   */
  readonly personality: PresetName;
  /**
   * Humanization pace for new sessions. Per-session overrides (via
   * `human_create_session({ speed })`) and runtime changes (via
   * `human_set_speed`) take precedence. Defaults to `'human'` — the full
   * realistic pace. `'fast'` keeps humanized motion but quicker; `'instant'`
   * bypasses humanization entirely (straight Playwright, no visible motion).
   *
   * Note: speed changes how long each action takes to *execute* — it does
   * not affect the wait *between* actions, which is the MCP client's
   * per-call model inference, outside this server's control.
   */
  readonly speed: Speed;
  /**
   * Whether the browser launches in headless mode. Defaults to `false`
   * (visible window) because the MCP audience — Claude Desktop, Cursor,
   * Codex — runs locally where seeing the browser is the point. Override
   * with `HUMANJS_HEADLESS=true` for CI or headless workflows.
   */
  readonly headless: boolean;
  /**
   * Directory recordings, screenshots, and PDFs land in. Defaults to the
   * MCP server's working directory at startup time (which clients usually
   * set to the user's home or workspace dir). Tools that produce files
   * accept a basename only — they never honor absolute paths.
   */
  readonly outputDir: string;
  /**
   * Directory `human_upload` reads files from. Defaults to the MCP server's
   * working directory at startup. Like the output tools, `human_upload`
   * accepts a basename only — `../`, subdirectories, and absolute paths are
   * rejected — so a prompt-injected filename can't read (and exfiltrate to a
   * web form) files outside this directory. Set `HUMANJS_UPLOAD_DIR` to the
   * folder your upload fixtures live in.
   */
  readonly uploadDir: string;
  /**
   * Default viewport for new sessions. Per-session overrides (via
   * `human_create_session`) and runtime resizes (via `human_set_viewport`)
   * take precedence. Defaults to 1440×900 — a comfortable desktop size
   * that fits any screen in headed mode; bump to `1920x1080` for crisper
   * recordings.
   */
  readonly viewport: { readonly width: number; readonly height: number };
  /**
   * Whether to auto-download the Chromium browser binary on first launch if
   * it's missing (the binary can't ship via npm). Defaults to `true` so
   * `npx -y @humanjs/mcp` works with zero manual setup. Set
   * `HUMANJS_AUTO_INSTALL=false` in locked-down environments where the
   * server shouldn't trigger a download — the first action then errors with
   * the manual `npx playwright install chromium` instruction instead.
   */
  readonly autoInstall: boolean;
  /**
   * How the browser is obtained, resolved from the browser-mode env vars.
   * A discriminated union so each variant carries exactly the data it needs
   * (no optional-everywhere / casts at the use sites):
   *
   * - `cdp` — attach to an already-running browser over CDP (`HUMANJS_CDP_URL`).
   *   Uses its existing context. Single-session; never closed on shutdown.
   * - `persistent` — launch with a persistent profile dir
   *   (`HUMANJS_USER_DATA_DIR`, or an auto dir when `HUMANJS_PERSIST=true`)
   *   so logins survive across runs. Single-session.
   * - `ephemeral` (default) — a fresh throwaway profile each run, with
   *   isolated multi-session support.
   */
  readonly browser: BrowserConfig;
  /**
   * Playwright browser channel — e.g. `'chrome'`, `'msedge'`. Launches that
   * installed browser's binary instead of bundled Chromium. NOTE: this alone
   * does NOT reuse your existing profile/logins — it's a fresh profile unless
   * combined with a persistent dir or CDP attach.
   */
  readonly channel: string | undefined;
}

/** How the browser is obtained — see {@link McpEnv.browser}. */
export type BrowserConfig =
  | { readonly mode: 'ephemeral' }
  | { readonly mode: 'persistent'; readonly userDataDir: string }
  | { readonly mode: 'cdp'; readonly cdpUrl: string };

/**
 * Reads environment variables once and freezes the result. Call from the
 * bin entry before constructing the server so any parse errors surface
 * immediately (and on stderr, where MCP clients can show them).
 */
export function readEnv(): McpEnv {
  return {
    personality: parsePersonality(process.env.HUMANJS_PERSONALITY),
    speed: parseSpeed(process.env.HUMANJS_SPEED),
    headless: parseBool(process.env.HUMANJS_HEADLESS, false),
    outputDir: process.env.HUMANJS_OUTPUT_DIR ?? process.cwd(),
    uploadDir: process.env.HUMANJS_UPLOAD_DIR ?? process.cwd(),
    viewport: parseViewport(process.env.HUMANJS_VIEWPORT),
    autoInstall: parseBool(process.env.HUMANJS_AUTO_INSTALL, true),
    browser: resolveBrowserConfig(),
    channel: process.env.HUMANJS_CHANNEL?.trim() || undefined,
  };
}

/** Default persistent profile dir when `HUMANJS_PERSIST=true` without an explicit path. */
export const DEFAULT_PERSIST_DIR = join(homedir(), '.humanjs', 'profile');

/**
 * Resolves the browser-config precedence: CDP wins (you explicitly pointed at
 * a running browser), then a persistent profile (explicit dir or the
 * `HUMANJS_PERSIST` auto-dir), else ephemeral.
 */
function resolveBrowserConfig(): BrowserConfig {
  const cdpUrl = process.env.HUMANJS_CDP_URL?.trim() || undefined;
  if (cdpUrl) return { mode: 'cdp', cdpUrl };
  const explicitDir = process.env.HUMANJS_USER_DATA_DIR?.trim() || undefined;
  if (explicitDir) return { mode: 'persistent', userDataDir: explicitDir };
  if (parseBool(process.env.HUMANJS_PERSIST, false)) {
    return { mode: 'persistent', userDataDir: DEFAULT_PERSIST_DIR };
  }
  return { mode: 'ephemeral' };
}

function parsePersonality(raw: string | undefined): PresetName {
  if (!raw) return 'careful';
  const lower = raw.toLowerCase() as PresetName;
  if (VALID_PRESETS.includes(lower)) return lower;
  throw new Error(
    `HUMANJS_PERSONALITY="${raw}" is not a known preset. Expected one of: ${VALID_PRESETS.join(', ')}.`,
  );
}

function parseSpeed(raw: string | undefined): Speed {
  if (!raw) return 'human';
  const lower = raw.toLowerCase() as Speed;
  if (VALID_SPEEDS.includes(lower)) return lower;
  throw new Error(
    `HUMANJS_SPEED="${raw}" is not valid. Expected one of: ${VALID_SPEEDS.join(', ')}.`,
  );
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const lower = raw.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  throw new Error(`Expected a boolean ("true"/"false"), got "${raw}".`);
}

function parseViewport(raw: string | undefined): { width: number; height: number } {
  if (!raw) return { width: 1440, height: 900 };
  const match = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(raw);
  if (!match) {
    throw new Error(
      `HUMANJS_VIEWPORT="${raw}" is invalid. Expected "WIDTHxHEIGHT", e.g. "1920x1080".`,
    );
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}
