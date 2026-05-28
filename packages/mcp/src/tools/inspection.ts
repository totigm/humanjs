/**
 * Inspection tools — read page state without modifying it. Without these
 * an AI agent is flying blind between humanized actions; with them, a
 * single MCP server covers the common "act + observe" loop without
 * needing to layer Playwright MCP alongside.
 *
 * Pass A scope: screenshot. Remaining (page_text, get_attribute,
 * get_text, get_html) land in Pass B.
 */

import { writeFile } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';
import { resolveOutputPath } from '../output';

const sessionArg = z
  .string()
  .optional()
  .describe('Session ID to act on. Omit to use the default session.');

export function registerInspectionTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'human_screenshot',
    {
      title: 'Screenshot the current page',
      description:
        'Captures the current page (or a specific element if `selector` is given) as a PNG and returns it as image content the AI can view directly. Pass `filename` to also save it to disk (HUMANJS_OUTPUT_DIR); omit it for an ephemeral look-at-the-page capture.',
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
        filename: z
          .string()
          .optional()
          .describe(
            'Optional plain filename (e.g. "homepage.png"). When set, the screenshot is saved to HUMANJS_OUTPUT_DIR. Path components are rejected for safety.',
          ),
        session: sessionArg,
      },
    },
    async ({ selector, fullPage, filename, session }) => {
      const { human, page } = await ctx.sessions.get(session);
      const buffer = selector
        ? await page.locator(selector).screenshot()
        : await human.screenshot({ fullPage: fullPage ?? false });

      const content: Array<
        { type: 'image'; data: string; mimeType: string } | { type: 'text'; text: string }
      > = [{ type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' }];

      if (filename) {
        const path = resolveOutputPath(ctx.env.outputDir, filename);
        await writeFile(path, buffer);
        content.push({ type: 'text', text: `saved screenshot to ${path}` });
      }

      return { content };
    },
  );
}
