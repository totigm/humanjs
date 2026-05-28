/**
 * Primitive tools — the humanized actions a user / AI agent performs in
 * the browser. Each one wraps a single `human.*` method, exposes a
 * minimal Zod schema, and returns a short text confirmation so the
 * agent has something to reason about.
 *
 * Pass A scope: goto, click, type. Remaining primitives (rightClick,
 * hover, move, drag, paste, press, scroll, read) land in Pass B once
 * the architecture is verified end-to-end.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session';

/** Optional session arg shared across every tool. */
const sessionArg = z
  .string()
  .optional()
  .describe(
    'Session ID to act on. Omit to use the default session (created lazily on first call). Use human_create_session for parallel browsers.',
  );

export function registerPrimitiveTools(server: McpServer, sessions: SessionManager): void {
  server.registerTool(
    'human_goto',
    {
      title: 'Navigate to URL',
      description:
        'Navigates the session\'s page to a URL. Plugins observe a "goto" action. Equivalent to a user typing a URL in the address bar.',
      inputSchema: {
        url: z.string().url().describe('Absolute URL to navigate to.'),
        session: sessionArg,
      },
    },
    async ({ url, session }) => {
      const { human } = await sessions.get(session);
      await human.goto(url);
      return {
        content: [{ type: 'text', text: `navigated to ${url}` }],
      };
    },
  );

  server.registerTool(
    'human_click',
    {
      title: 'Click an element (humanized)',
      description:
        'Moves the cursor to the element along a humanized Bezier path and clicks. The click point inside the element is Gaussian-distributed around the center, matching real human aim.',
      inputSchema: {
        selector: z
          .string()
          .describe(
            'Playwright-compatible selector. Prefer role-based (`role=button[name="Buy"]`) or text selectors (`text="Submit"`) over brittle CSS — same advice as Playwright.',
          ),
        session: sessionArg,
      },
    },
    async ({ selector, session }) => {
      const { human } = await sessions.get(session);
      await human.click(selector);
      return {
        content: [{ type: 'text', text: `clicked ${selector}` }],
      };
    },
  );

  server.registerTool(
    'human_type',
    {
      title: 'Type text into an element (humanized)',
      description:
        'Clicks the element to focus it, then types `value` with humanized per-key rhythm. The current personality controls typing speed, typo probability, and corrections — set with HUMANJS_PERSONALITY or human_set_personality.',
      inputSchema: {
        selector: z
          .string()
          .describe('Selector of the input/textarea/contenteditable to type into.'),
        value: z.string().describe('Text to type. May contain newlines.'),
        session: sessionArg,
      },
    },
    async ({ selector, value, session }) => {
      const { human } = await sessions.get(session);
      await human.type(selector, value);
      return {
        content: [{ type: 'text', text: `typed ${value.length} chars into ${selector}` }],
      };
    },
  );
}
