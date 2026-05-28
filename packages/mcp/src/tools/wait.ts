/**
 * Wait tools — let the agent settle the page between actions. Two distinct
 * needs:
 *
 * - `human_wait` — a fixed pause, for client-side things that fire no
 *   network event: debounced search-as-you-type, CSS animations, list
 *   reflows. Targeting an element before it settles can click a stale
 *   position, because the cursor travels over a short window and the
 *   layout may shift mid-travel.
 * - `human_wait_for_load` — wait for navigation / network to settle,
 *   e.g. after a click that loads a new page, before stopping a recording
 *   or acting on the new page.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';

export function registerWaitTools(server: McpServer, { sessions }: ToolContext): void {
  server.registerTool(
    'human_wait',
    {
      title: 'Wait a fixed time',
      description:
        'Pauses for `ms` milliseconds. Use after a debounced search/filter, an animation, or any client-side re-render that fires no network event, to let the UI settle before targeting the next element. For navigation, prefer human_wait_for_load.',
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

  server.registerTool(
    'human_wait_for_load',
    {
      title: 'Wait for the page to load',
      description:
        'Waits until the page reaches a load state. Use after an action that navigates (e.g. a click that opens a new page) before stopping a recording or acting on the new page — a click resolves when dispatched, not when navigation finishes. `networkidle` also catches debounced XHR/fetch settling.',
      inputSchema: {
        state: z
          .enum(['load', 'domcontentloaded', 'networkidle'])
          .optional()
          .describe(
            'Load state to await. Default "load". Use "networkidle" to wait out async requests.',
          ),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ state, session }) => {
      const { human } = await sessions.get(session);
      await human.waitForLoadState(state ?? 'load');
      return { content: [{ type: 'text', text: `page reached "${state ?? 'load'}"` }] };
    },
  );
}
