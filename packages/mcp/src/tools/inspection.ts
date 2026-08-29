/**
 * Inspection tools — read page state without modifying it. Without these
 * an AI agent is flying blind between humanized actions; with them, a
 * single MCP server covers the common "act + observe" loop without
 * needing to layer Playwright MCP alongside.
 *
 * Deliberately no arbitrary-`evaluate` tool — that's a prompt-injection
 * cliff (a malicious page could trick the agent into running JS that
 * exfiltrates data). These read-only tools cover the legitimate need:
 * see the page text, discover an element's real selector / attributes,
 * grab a region's HTML. The internal `locator.evaluate` calls below run
 * fixed functions, never AI-supplied code.
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

const allArg = z
  .boolean()
  .optional()
  .describe(
    'Read every element the selector matches instead of just the first. Use it to sweep a page — all image sources, all row labels, all link hrefs — in one call.',
  );

/** Caps a sweep so one call can't blow the agent's context window. */
function matchLimitArg(fallback: number) {
  return z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      `With \`all\`, the maximum number of matches to return (default ${fallback}). The total number found is always reported.`,
    );
}

/** Footer telling the agent when it is looking at a truncated sweep. */
function sweepSummary(shown: number, total: number, selector: string): string {
  if (shown >= total) {
    return `— ${total} element${total === 1 ? '' : 's'} matched ${selector}`;
  }
  return `— showing the first ${shown} of ${total} elements matching ${selector}; raise \`limit\` to see more`;
}

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

      // Always pair the image with a line of text. An image-only result is
      // rendered as "Tool ran without output or errors" by MCP clients that
      // key their summary off text content, which reads as a failure even
      // though the capture succeeded.
      const scope = selector ? `element ${selector}` : fullPage ? 'full page' : 'viewport';
      const content: Array<
        { type: 'image'; data: string; mimeType: string } | { type: 'text'; text: string }
      > = [
        { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' },
        { type: 'text', text: `captured ${scope} of ${page.url()}` },
      ];

      if (filename) {
        const path = resolveOutputPath(ctx.env.outputDir, filename);
        await writeFile(path, buffer);
        content.push({ type: 'text', text: `saved screenshot to ${path}` });
      }

      return { content };
    },
  );

  server.registerTool(
    'human_page_text',
    {
      title: 'Get visible page text',
      description:
        "Returns the page's visible text (document.body.innerText). The fastest way to understand what's on screen without parsing HTML — prefer this over human_get_html unless you need element structure or attributes.",
      inputSchema: { session: sessionArg },
    },
    async ({ session }) => {
      const { human } = await ctx.sessions.get(session);
      const text = await human.pageText();
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'human_outline',
    {
      title: 'Page outline (accessibility tree)',
      description:
        'Returns a compact accessibility-tree outline of the page (or a region) — every interactive element and landmark by its ARIA role + accessible name, as YAML (e.g. `- button "Sign in"`, `- textbox "Email"`). The most token-efficient way to see what is actionable and pick a selector: the names map directly to getByRole / accessible-name selectors. Prefer this over human_get_html for "what can I click or fill"; use human_screenshot when you need the visual layout.',
      inputSchema: {
        selector: z
          .string()
          .optional()
          .describe('Optional region selector to scope the outline. Omit for the whole page.'),
        session: sessionArg,
      },
    },
    async ({ selector, session }) => {
      const { human } = await ctx.sessions.get(session);
      const text = await human.outline(selector);
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'human_get_text',
    {
      title: "Get an element's text",
      description:
        "Returns the visible innerText of the first element matching `selector` — a specific label, price, status, or message. Set `all` to read every match instead, e.g. every row's title in a table.",
      inputSchema: {
        selector: z.string().describe('Selector of the element to read.'),
        all: allArg,
        limit: matchLimitArg(100),
        session: sessionArg,
      },
    },
    async ({ selector, all, limit, session }) => {
      const { page } = await ctx.sessions.get(session);
      if (!all) {
        const text = await page.locator(selector).first().innerText();
        return { content: [{ type: 'text', text }] };
      }
      const elements = await page.locator(selector).all();
      const shown = elements.slice(0, limit ?? 100);
      const values = await Promise.all(shown.map((element) => element.innerText()));
      const body = values.map((value, index) => `[${index}] ${value}`).join('\n');
      const text =
        elements.length === 0
          ? `No elements matched ${selector}`
          : `${body}\n\n${sweepSummary(shown.length, elements.length, selector)}`;
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'human_get_attribute',
    {
      title: "Get an element's attribute",
      description:
        "Returns the value of an attribute on the first element matching `selector` (or reports it is absent). Handy for reading aria-label, data-*, href, value, disabled state, etc. — often how you confirm an icon-only button's purpose. Set `all` to collect the attribute across every match, which is the compact way to extract every image source or link target on a page.",
      inputSchema: {
        selector: z.string().describe('Selector of the element.'),
        attribute: z.string().describe('Attribute name, e.g. "aria-label", "href", "data-state".'),
        all: allArg,
        limit: matchLimitArg(100),
        session: sessionArg,
      },
    },
    async ({ selector, attribute, all, limit, session }) => {
      const { page } = await ctx.sessions.get(session);
      if (!all) {
        const value = await page.locator(selector).first().getAttribute(attribute);
        const text =
          value === null
            ? `${selector} has no attribute "${attribute}"`
            : `${attribute}="${value}"`;
        return { content: [{ type: 'text', text }] };
      }
      const elements = await page.locator(selector).all();
      const shown = elements.slice(0, limit ?? 100);
      const values = await Promise.all(shown.map((element) => element.getAttribute(attribute)));
      // A missing attribute is reported per element rather than dropped:
      // "which of these has no href" is usually the interesting answer.
      const body = values
        .map((value, index) => `[${index}] ${value === null ? '(absent)' : value}`)
        .join('\n');
      const text =
        elements.length === 0
          ? `No elements matched ${selector}`
          : `${body}\n\n${sweepSummary(shown.length, elements.length, selector)}`;
      return { content: [{ type: 'text', text }] };
    },
  );

  server.registerTool(
    'human_get_html',
    {
      title: "Get an element's HTML",
      description:
        'Returns the outerHTML of the first element matching `selector` — the element plus its children, including its own attributes (class, aria-label, etc.). The go-to tool for discovering the real selector of a control with no obvious text. Target a specific region; full-page HTML is large. Set `all` to dump every match, but prefer human_get_attribute with `all` when you only need one attribute from each — it returns the same information for a fraction of the tokens.',
      inputSchema: {
        selector: z.string().describe('Selector of the region to dump. Target narrowly.'),
        all: allArg,
        limit: matchLimitArg(10),
        session: sessionArg,
      },
    },
    async ({ selector, all, limit, session }) => {
      const { page } = await ctx.sessions.get(session);
      // Fixed function, not AI-supplied — outerHTML isn't a Playwright
      // locator method, so we read it via a constrained evaluate. Written
      // inline at both call sites so Playwright infers the element type;
      // the repo's tsconfig has no DOM lib to annotate it with.
      if (!all) {
        const html = await page
          .locator(selector)
          .first()
          .evaluate((el) => el.outerHTML);
        return { content: [{ type: 'text', text: html }] };
      }
      // Capped tighter than the other sweeps: a handful of outerHTML dumps
      // is already a lot of tokens.
      const elements = await page.locator(selector).all();
      const shown = elements.slice(0, limit ?? 10);
      const values: string[] = await Promise.all(
        shown.map((element) => element.evaluate((el) => el.outerHTML)),
      );
      const body = values.map((value, index) => `[${index}] ${value}`).join('\n\n');
      const text =
        elements.length === 0
          ? `No elements matched ${selector}`
          : `${body}\n\n${sweepSummary(shown.length, elements.length, selector)}`;
      return { content: [{ type: 'text', text }] };
    },
  );
}
