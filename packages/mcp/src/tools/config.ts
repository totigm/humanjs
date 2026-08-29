/**
 * Config tools — runtime tweaks to how a session behaves: personality
 * (env var sets the default, this changes it mid-session), humanization
 * speed, viewport size (resize the live page for a bigger/crisper
 * recording or to test responsive layouts), and emulated media features.
 */

import { blend } from '@humanjs/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';

const preset = z.enum(['careful', 'fast', 'distracted', 'precise']);

/**
 * Playwright resets an emulated media feature with `null`. `'system'` is
 * the clearer word for an agent choosing a value, so it is translated here
 * rather than exposing `null` in the tool schema.
 */
function toMediaValue<T extends string>(value: T | 'system' | undefined): T | null | undefined {
  if (value === undefined) return undefined;
  return value === 'system' ? null : value;
}

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

  server.registerTool(
    'human_set_speed',
    {
      title: 'Set humanization speed',
      description:
        'Changes a session\'s humanization pace at runtime. "human" = full realistic motion (best for recordings); "fast" = humanized but quicker; "instant" = no humanized motion (straight Playwright). Note: this changes how long each action takes to execute, not the wait between actions. Cannot change while recording.',
      inputSchema: {
        speed: z.enum(['human', 'fast', 'instant']).describe('The pace to switch to.'),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ speed, session }) => {
      const info = await sessions.setSpeed(session, speed);
      return { content: [{ type: 'text', text: `set "${info.id}" speed to ${speed}` }] };
    },
  );

  server.registerTool(
    'human_set_viewport',
    {
      title: 'Resize the viewport',
      description:
        "Resizes a session's browser viewport at runtime. Use for a bigger/crisper recording or to test responsive layouts. The default size for new sessions is set by HUMANJS_VIEWPORT (default 1440×900).",
      inputSchema: {
        width: z.number().int().positive().describe('Viewport width in CSS px.'),
        height: z.number().int().positive().describe('Viewport height in CSS px.'),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ width, height, session }) => {
      const { human } = await sessions.get(session);
      await human.setViewportSize({ width, height });
      return { content: [{ type: 'text', text: `viewport set to ${width}×${height}` }] };
    },
  );
  server.registerTool(
    'human_emulate_media',
    {
      title: 'Emulate media features',
      description:
        "Emulates CSS media features for a session so you can verify the accessibility and theming paths a real user would get. `reducedMotion: 'reduce'` is the important one: it is the only way to check that a site's prefers-reduced-motion path actually works, and it is normally impossible to test without changing OS settings. Settings persist across navigations until changed; pass 'system' to stop emulating a feature.",
      inputSchema: {
        reducedMotion: z
          .enum(['reduce', 'no-preference', 'system'])
          .optional()
          .describe(
            "Emulate prefers-reduced-motion. Use 'reduce' to verify the reduced-motion path renders and stays usable.",
          ),
        colorScheme: z
          .enum(['light', 'dark', 'no-preference', 'system'])
          .optional()
          .describe('Emulate prefers-color-scheme, to check the light and dark themes.'),
        forcedColors: z
          .enum(['active', 'none', 'system'])
          .optional()
          .describe(
            "Emulate forced-colors (Windows High Contrast). 'active' reveals content that disappears when the author's colors are overridden.",
          ),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ reducedMotion, colorScheme, forcedColors, session }) => {
      if (reducedMotion === undefined && colorScheme === undefined && forcedColors === undefined) {
        throw new Error(
          'Pass at least one of `reducedMotion`, `colorScheme` or `forcedColors`. Use "system" to stop emulating one.',
        );
      }
      const { page } = await sessions.get(session);
      await page.emulateMedia({
        reducedMotion: toMediaValue(reducedMotion),
        colorScheme: toMediaValue(colorScheme),
        forcedColors: toMediaValue(forcedColors),
      });
      const applied = [
        reducedMotion && `prefers-reduced-motion: ${reducedMotion}`,
        colorScheme && `prefers-color-scheme: ${colorScheme}`,
        forcedColors && `forced-colors: ${forcedColors}`,
      ].filter(Boolean);
      return {
        content: [
          {
            type: 'text',
            text: `emulating ${applied.join(', ')} — re-render or navigate if the page only reads these at load`,
          },
        ],
      };
    },
  );
}
