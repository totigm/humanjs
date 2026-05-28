/**
 * Browser-lifecycle tools — inspect how the browser is obtained, toggle a
 * persistent profile at runtime, and restart the browser to apply changes.
 *
 * Browser *mode* (ephemeral / persistent / CDP-attach) is otherwise an
 * up-front config decision via env vars (HUMANJS_PERSIST,
 * HUMANJS_USER_DATA_DIR, HUMANJS_CDP_URL, HUMANJS_CHANNEL). These tools
 * cover the in-chat conveniences; switching to the user's *real* browser
 * stays env-only by design (it's a consent decision the agent shouldn't
 * escalate into).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';

export function registerBrowserTools(server: McpServer, { sessions }: ToolContext): void {
  server.registerTool(
    'human_browser_info',
    {
      title: 'Browser configuration',
      description:
        'Reports how the browser is obtained (ephemeral fresh profile, persistent profile, or attached over CDP), the channel, and whether logins persist. Use it to explain to the user why they are or are not signed in, and how to change it.',
      inputSchema: {},
    },
    async () => {
      const info = sessions.browserInfo();
      const lines: string[] = [];
      if (info.mode === 'cdp') {
        lines.push(`Mode: attached to your running browser over CDP (${info.cdpUrl}).`);
        lines.push("Uses that browser's existing logins, tabs, and extensions.");
      } else if (info.mode === 'persistent') {
        lines.push(`Mode: persistent profile at ${info.userDataDir}.`);
        lines.push('Logins persist across runs (sign in once; it sticks).');
      } else {
        lines.push('Mode: ephemeral — a fresh, empty profile each run (no saved logins).');
        lines.push(
          'To keep logins across runs: call human_enable_persistence, or set HUMANJS_PERSIST=true in the MCP config for a permanent default.',
        );
      }
      lines.push(`Channel: ${info.channel ?? 'bundled Chromium'}.`);
      lines.push(`Browser running: ${info.browserRunning ? 'yes' : 'no'}.`);
      if (info.persistPendingRestart) {
        lines.push(
          'A persistence change is set but not yet applied — call human_restart_browser to apply it now.',
        );
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.registerTool(
    'human_enable_persistence',
    {
      title: 'Enable a persistent profile',
      description:
        'Switches HumanJS to a persistent browser profile so logins/cookies survive across runs. Takes effect on the next browser start; pass restartNow:true to apply immediately (restarting discards the current page — re-navigate after). For a permanent default, set HUMANJS_PERSIST=true in the MCP config instead. Note: this does NOT use your real Chrome profile (that stays an env-only, opt-in setting).',
      inputSchema: {
        userDataDir: z
          .string()
          .optional()
          .describe('Optional profile directory. Defaults to ~/.humanjs/profile.'),
        restartNow: z
          .boolean()
          .optional()
          .describe(
            'Restart the browser immediately to apply (discards the current page). Default false.',
          ),
      },
    },
    async ({ userDataDir, restartNow }) => {
      sessions.setPersistOverride(userDataDir);
      const info = sessions.browserInfo();
      let text = `Persistence enabled (profile: ${info.userDataDir}).`;
      if (info.persistPendingRestart) {
        if (restartNow) {
          await sessions.restartBrowser();
          text += ' Browser restarted — re-navigate to your page; logins will now persist.';
        } else {
          text +=
            ' Active on the next browser start. Call human_restart_browser to apply now (discards the current page).';
        }
      } else {
        text += ' It will apply on the next action.';
      }
      text += ' For a permanent default, set HUMANJS_PERSIST=true in your MCP config.';
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'human_restart_browser',
    {
      title: 'Restart the browser',
      description:
        'Closes the browser and all sessions; the next action launches a fresh one in the current mode. Use to apply a persistence change, or to recover a wedged browser. Discards open pages/tabs — re-navigate afterward. (Does not affect a CDP-attached browser beyond disconnecting.)',
      inputSchema: {},
    },
    async () => {
      await sessions.restartBrowser();
      return {
        content: [
          {
            type: 'text',
            text: 'Browser restarted. The next action launches a fresh browser in the current mode — re-navigate to your page.',
          },
        ],
      };
    },
  );
}
