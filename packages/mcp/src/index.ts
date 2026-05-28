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

async function main(): Promise<void> {
  const env = readEnv();
  const sessions = new SessionManager(env);
  const ctx: ToolContext = { sessions, env };

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

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
