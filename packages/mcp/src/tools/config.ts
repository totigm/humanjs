/**
 * Config tools — runtime tweaks to how a session behaves. Currently just
 * personality; the env var sets the default, this changes it mid-session
 * ("now drive this form like a distracted user").
 */

import { blend } from '@humanjs/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';

const preset = z.enum(['careful', 'fast', 'distracted', 'precise']);

export function registerConfigTools(server: McpServer, { sessions }: ToolContext): void {
  server.registerTool(
    'human_set_personality',
    {
      title: 'Set session personality',
      description:
        'Changes the humanization personality for a session at runtime. Pass a preset, or a blend of two presets (e.g. mostly careful with a touch of distracted). The browser, cookies, and scroll position are preserved — only the motion/typing/reading profile changes.',
      inputSchema: {
        personality: preset
          .optional()
          .describe('A preset to apply. Provide this OR `blend`, not both.'),
        blend: z
          .object({
            a: preset.describe('First personality.'),
            b: preset.describe('Second personality.'),
            ratio: z
              .number()
              .min(0)
              .max(1)
              .describe('Weight toward `b` (0 = all a, 1 = all b). e.g. 0.3 = mostly a.'),
          })
          .optional()
          .describe('Blend two presets. Provide this OR `personality`, not both.'),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ personality, blend: blendArg, session }) => {
      if (personality && blendArg) {
        throw new Error('Provide either `personality` or `blend`, not both.');
      }
      if (!personality && !blendArg) {
        throw new Error('Provide a `personality` preset or a `blend`.');
      }

      const config = blendArg ? blend(blendArg.a, blendArg.b, blendArg.ratio) : personality;
      // `config` is defined here: exactly one branch ran (validated above).
      const info = await sessions.setPersonality(session, config as NonNullable<typeof config>);
      const label = blendArg
        ? `blend(${blendArg.a}, ${blendArg.b}, ${blendArg.ratio})`
        : (personality as string);
      return {
        content: [{ type: 'text', text: `set "${info.id}" personality to ${label}` }],
      };
    },
  );
}
