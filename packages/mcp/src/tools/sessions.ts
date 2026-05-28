/**
 * Session tools — multi-session control. Most agents never touch these:
 * the default session is created lazily and every other tool defaults to
 * it. They exist for the parallel-browser case (e.g. comparing two flows
 * side by side, or isolating cookies between accounts).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';

const personalityArg = z
  .enum(['careful', 'fast', 'distracted', 'precise'])
  .optional()
  .describe('Personality preset for this session. Defaults to HUMANJS_PERSONALITY.');

const speedArg = z
  .enum(['human', 'fast', 'instant'])
  .optional()
  .describe(
    'Humanization pace. "human" (default) = full realistic motion; "fast" = humanized but quick; "instant" = no humanized motion. Defaults to HUMANJS_SPEED.',
  );

export function registerSessionTools(server: McpServer, { sessions }: ToolContext): void {
  server.registerTool(
    'human_create_session',
    {
      title: 'Create a browser session',
      description:
        'Opens a new isolated session (its own browser context, cookies, viewport) under the given ID. Only needed for parallel browsers — for a single browser, just omit the session arg on other tools and the default session is used.',
      inputSchema: {
        id: z.string().describe('Unique session ID, e.g. "buyer", "seller".'),
        personality: personalityArg,
        speed: speedArg,
        width: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Viewport width in CSS px. Defaults to HUMANJS_VIEWPORT. Requires height.'),
        height: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Viewport height in CSS px. Requires width.'),
      },
    },
    async ({ id, personality, speed, width, height }) => {
      if ((width === undefined) !== (height === undefined)) {
        throw new Error('Provide both width and height, or neither.');
      }
      const viewport = width !== undefined && height !== undefined ? { width, height } : undefined;
      const session = await sessions.create(id, { personality, speed, viewport });
      return {
        content: [
          {
            type: 'text',
            text: `created session "${session.id}" (personality: ${session.personality}, speed: ${session.speed})`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'human_close_session',
    {
      title: 'Close a browser session',
      description:
        'Closes a session and frees its browser context. Closing the default session is allowed — it will be recreated lazily on the next call.',
      inputSchema: {
        id: z.string().describe('Session ID to close.'),
      },
    },
    async ({ id }) => {
      await sessions.close(id);
      return { content: [{ type: 'text', text: `closed session "${id}"` }] };
    },
  );

  server.registerTool(
    'human_list_sessions',
    {
      title: 'List open sessions',
      description:
        'Lists every currently-open session with its personality. Use to orient before acting on a specific session.',
      inputSchema: {},
    },
    async () => {
      const list = sessions.list();
      const text =
        list.length === 0
          ? 'no open sessions (the default session is created on first action)'
          : list
              .map((s) => `${s.id} (personality: ${s.personality}, speed: ${s.speed})`)
              .join('\n');
      return { content: [{ type: 'text', text }] };
    },
  );
}
