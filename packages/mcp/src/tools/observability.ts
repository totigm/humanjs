/**
 * Observability tools — what the page said about itself.
 *
 * Screenshots and page text show what rendered; they say nothing about a
 * CORS rejection, a 404 on an asset, or an uncaught TypeError that left a
 * component half-mounted. These two tools close that gap, which otherwise
 * pushes an agent into guessing or into checking with `curl` from outside
 * the browser — where the request has none of the browser's origin,
 * cookies, or headers, so the failure being investigated does not even
 * reproduce.
 *
 * Buffers start filling when the session is created, so an agent can act
 * first and ask afterwards; there is no "start capturing" call to forget.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';
import { formatConsole, formatNetwork, queryConsole, queryNetwork } from '../observability';

const sessionArg = z
  .string()
  .optional()
  .describe('Session ID to read from. Omit to use the default session.');

const patternArg = z
  .string()
  .optional()
  .describe(
    'Case-insensitive regular expression to filter by. Omit to see everything. Use it to cut noise on chatty pages, e.g. "cors|refused" or "\\\\.png$".',
  );

/** Keeps a single response token-bounded on pages that log or fetch constantly. */
const DEFAULT_LIMIT = 50;

const limitArg = z
  .number()
  .int()
  .positive()
  .optional()
  .describe(
    `Maximum entries to return, most recent first-in-list-last (default ${DEFAULT_LIMIT}). The count of everything that matched is always reported, so you can tell when you are seeing a slice.`,
  );

const clearArg = z
  .boolean()
  .optional()
  .describe(
    'Empty the buffer after returning these entries. Use it to get a clean slate before an action, so the next call shows only what that action caused.',
  );

export function registerObservabilityTools(server: McpServer, { sessions }: ToolContext): void {
  server.registerTool(
    'human_console_messages',
    {
      title: 'Read the browser console',
      description:
        "Returns console output and uncaught page errors captured for this session, newest last. Capture starts when the session is created, so this covers everything since — including errors thrown during the first page load. The go-to tool when something looks wrong on the page but the screenshot doesn't explain why: CORS rejections, failed asset loads, and thrown exceptions all surface here and nowhere else.",
      inputSchema: {
        pattern: patternArg,
        onlyErrors: z
          .boolean()
          .optional()
          .describe(
            'Keep only console.error output and uncaught page errors, dropping log/info/warn/debug.',
          ),
        limit: limitArg,
        clear: clearArg,
        session: sessionArg,
      },
    },
    async ({ pattern, onlyErrors, limit, clear, session }) => {
      const { observers } = await sessions.get(session);
      const result = queryConsole(observers.console, {
        pattern,
        onlyErrors,
        limit: limit ?? DEFAULT_LIMIT,
      });
      const text = formatConsole(result);
      if (clear) observers.console.clear();
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'human_network_requests',
    {
      title: 'Inspect network activity',
      description:
        'Returns network responses captured for this session, newest last, with method, URL, HTTP status and round-trip time. Requests that never got a response (DNS failure, blocked by CORS, aborted) are included with the browser\'s failure reason instead of a status. Use `onlyFailures` to answer "what broke?" in one call — it covers both 4xx/5xx responses and requests that never completed.',
      inputSchema: {
        pattern: patternArg,
        onlyFailures: z
          .boolean()
          .optional()
          .describe(
            'Keep only 4xx/5xx responses and requests that failed before responding. The fastest way to find a broken asset or API call.',
          ),
        status: z
          .number()
          .int()
          .optional()
          .describe('Keep only responses with this exact HTTP status, e.g. 404 or 500.'),
        limit: limitArg,
        clear: clearArg,
        session: sessionArg,
      },
    },
    async ({ pattern, onlyFailures, status, limit, clear, session }) => {
      const { observers } = await sessions.get(session);
      const result = queryNetwork(observers.network, {
        pattern,
        onlyFailures,
        status,
        limit: limit ?? DEFAULT_LIMIT,
      });
      const text = formatNetwork(result);
      if (clear) observers.network.clear();
      return { content: [{ type: 'text', text }] };
    },
  );
}
