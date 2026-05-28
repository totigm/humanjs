/**
 * Environment-variable configuration for `@humanjs/mcp`. Every option is
 * read once at startup; runtime changes don't take effect until the MCP
 * server restarts. The `set_personality` tool is the one exception —
 * personality can flip per-session at runtime.
 */

import type { PresetName } from '@humanjs/core';

const VALID_PRESETS: readonly PresetName[] = ['careful', 'fast', 'distracted', 'precise'] as const;

export interface McpEnv {
  /**
   * Default personality applied to every new session. Per-session overrides
   * (via `human_create_session({ personality })`) and runtime changes
   * (via `human_set_personality`) take precedence.
   */
  readonly personality: PresetName;
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
}

/**
 * Reads environment variables once and freezes the result. Call from the
 * bin entry before constructing the server so any parse errors surface
 * immediately (and on stderr, where MCP clients can show them).
 */
export function readEnv(): McpEnv {
  return {
    personality: parsePersonality(process.env.HUMANJS_PERSONALITY),
    headless: parseBool(process.env.HUMANJS_HEADLESS, false),
    outputDir: process.env.HUMANJS_OUTPUT_DIR ?? process.cwd(),
  };
}

function parsePersonality(raw: string | undefined): PresetName {
  if (!raw) return 'careful';
  const lower = raw.toLowerCase() as PresetName;
  if (VALID_PRESETS.includes(lower)) return lower;
  throw new Error(
    `HUMANJS_PERSONALITY="${raw}" is not a known preset. Expected one of: ${VALID_PRESETS.join(', ')}.`,
  );
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const lower = raw.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  throw new Error(`Expected a boolean ("true"/"false"), got "${raw}".`);
}
