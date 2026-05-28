/**
 * @humanjs/mcp — Model Context Protocol server for HumanJS.
 *
 * Exposes humanized browser automation primitives as MCP tools so AI
 * agents (Claude Desktop, Claude Code, Cursor, Codex, Cline, …) can drive
 * a Playwright browser with realistic motion, typing, reading dwell, and
 * everything else `@humanjs/playwright` provides.
 *
 * The bin entry (`humanjs-mcp` after install) speaks stdio MCP — the
 * lingua franca every desktop AI client supports.
 *
 * Configuration (e.g. in `~/.claude.json`, `.mcp.json`, `.cursor/mcp.json`):
 *
 * ```jsonc
 * {
 *   "mcpServers": {
 *     "humanjs": {
 *       "command": "npx",
 *       "args": ["-y", "@humanjs/mcp"],
 *       "env": { "HUMANJS_PERSONALITY": "careful" }
 *     }
 *   }
 *  }
 * ```
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ToolContext } from './context';
import { readEnv } from './env';
import { SessionManager } from './session';
import { registerBrowserTools } from './tools/browser';
import { registerConfigTools } from './tools/config';
import { registerInspectionTools } from './tools/inspection';
import { registerPrimitiveTools } from './tools/primitives';
import { registerRecordingTools } from './tools/recording';
import { registerSessionTools } from './tools/sessions';

const SERVER_NAME = 'humanjs-mcp';
const SERVER_VERSION = '0.1.0';

/**
 * Standing guidance surfaced to the agent at connect time (MCP `instructions`).
 * Encodes the workflow and edge-case handling that otherwise the user has to
 * spell out every time — especially for recordings, which only look natural
 * when the agent explores first and runs a clean pass.
 */
const SERVER_INSTRUCTIONS = `HumanJS drives a real browser with humanized motion, typing, and reading dwell. Motion is already realistic at the default speed — do NOT switch to 'fast'/'instant' or change personality to make a flow "look natural"; it already does.

Recording a flow (the natural-looking way):
1. EXPLORE FIRST. Navigate the flow once to discover correct, unambiguous selectors (use human_screenshot / human_get_html / human_get_attribute). Don't record this pass.
2. THEN RECORD ONE CLEAN RUN. human_start_recording, perform the discovered steps back-to-back, human_stop_recording. A recording that includes selector-guessing or fumbles looks robotic — keep that out of the take.
You don't need the user to ask for an exploration pass; do it whenever the selectors aren't already known.

Handling dynamic UI (do this even outside recordings):
- Prefer specific selectors (role, aria-label) over text. The same visible text often matches several cards before filtering, or the wrong one after. If a click reports multiple matches, narrow the selector.

Browser state: by default each run is a fresh, signed-out browser. If a flow needs a login, tell the user to enable persistence (human_enable_persistence or HUMANJS_PERSIST) or CDP attach — see human_browser_info.`;

async function main(): Promise<void> {
  const env = readEnv();
  const sessions = new SessionManager(env);
  const ctx: ToolContext = { sessions, env };

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerPrimitiveTools(server, ctx);
  registerInspectionTools(server, ctx);
  registerRecordingTools(server, ctx);
  registerSessionTools(server, ctx);
  registerConfigTools(server, ctx);
  registerBrowserTools(server, ctx);

  // Shutdown: when the MCP client disconnects (stdio EOF) or the process
  // gets a signal, tear down browsers cleanly so we don't leak chrome
  // processes on the user's machine.
  const shutdown = async (): Promise<void> => {
    try {
      await sessions.closeAll();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // MCP servers communicate over stdout — never log there. stderr is the
  // only safe channel for diagnostics; clients surface it as server-side
  // errors.
  console.error('[humanjs-mcp] fatal:', error);
  process.exit(1);
});
