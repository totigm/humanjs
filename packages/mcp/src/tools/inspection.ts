/**
 * Inspection tools — read page state without modifying it. Without these
 * an AI agent is flying blind between humanized actions; with them, a
 * single MCP server covers the common "act + observe" loop without
 * needing to layer Playwright MCP alongside.
 *
 * Pass A scope: screenshot. Remaining (page_text, get_attribute,
 * get_text, get_html) land in Pass B.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session';

const sessionArg = z
  .string()
  .optional()
  .describe('Session ID to act on. Omit to use the default session.');

export function registerInspectionTools(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'human_screenshot',
    {
      title: 'Screenshot the current page',
      description:
        'Captures the current page (or a specific element if `selector` is given) as a PNG and returns it as image content the AI can view directly. Useful between humanized actions to see what changed.',
      inputSchema: {
        selector: z
          .string()
          .optional()
          .describe('Optional selector. If omitted, captures the entire viewport.'),
        fullPage: z
          .boolean()
          .optional()
          .describe(
            'Capture the full scrollable page instead of just the viewport. Ignored if `selector` is set.',
          ),
        session: sessionArg,
      },
    },
    async ({ selector, fullPage, session }) => {
      const { human, page } = await sessions.get(session);
      const buffer = selector
        ? await page.locator(selector).screenshot()
        : await human.screenshot({ fullPage: fullPage ?? false });
      return {
        content: [
          {
            type: 'image',
            data: buffer.toString('base64'),
            mimeType: 'image/png',
          },
        ],
      };
    },
  );
}
