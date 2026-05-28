/**
 * Wait tool — let the agent settle the page between actions.
 *
 * `human_wait` is a fixed pause, for client-side things that fire no
 * network event: debounced search-as-you-type, CSS animations, list
 * reflows. Targeting an element before it settles can click a stale
 * position, because the cursor travels over a short window and the
 * layout may shift mid-travel.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';

// `_ctx` is unused now that the only wait tool is a pure timer — kept in
// the signature for parity with the other register* functions.
export function registerWaitTools(server: McpServer, _ctx: ToolContext): void {
  server.registerTool(
    'human_wait',
    {
      title: 'Wait a fixed time',
      description:
        'Pauses for `ms` milliseconds. Use after a debounced search/filter, an animation, or any client-side re-render, to let the UI settle before targeting the next element.',
      inputSchema: {
        ms: z
          .number()
          .int()
          .positive()
          .max(30000)
          .describe('How long to wait, in milliseconds (e.g. 400 for a typical debounce).'),
      },
    },
    async ({ ms }) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return { content: [{ type: 'text', text: `waited ${ms}ms` }] };
    },
  );
}
