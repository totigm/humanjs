/**
 * Primitive tools — the humanized actions a user / AI agent performs in
 * the browser. Each wraps a single `human.*` method, exposes a focused Zod
 * schema, and returns a short text confirmation so the agent has something
 * to reason about.
 *
 * Mouse targets (click, rightClick, move, drag endpoints) accept a selector
 * OR raw x/y coordinates — see `targets.ts`. Coordinates are the fallback
 * for controls with no clean selector (icon-only buttons, canvas, SVG)
 * that the AI can see in a screenshot.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';
import { resolveTarget, targetFields } from './targets';

const sessionArg = z
  .string()
  .optional()
  .describe(
    'Session ID to act on. Omit to use the default session (created lazily on first call). Use human_create_session for parallel browsers.',
  );

export function registerPrimitiveTools(server: McpServer, { sessions }: ToolContext): void {
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
      return { content: [{ type: 'text', text: `navigated to ${url}` }] };
    },
  );

  server.registerTool(
    'human_click',
    {
      title: 'Click (humanized)',
      description:
        'Moves the cursor to the target along a humanized Bezier path and clicks. Target is a selector OR x/y coordinates — use coordinates for icon-only buttons or anything with no clean selector that you can see in a screenshot.',
      inputSchema: { ...targetFields, session: sessionArg },
    },
    async ({ selector, x, y, session }) => {
      const { human } = await sessions.get(session);
      const target = resolveTarget({ selector, x, y });
      await human.click(target);
      return { content: [{ type: 'text', text: `clicked ${describeTarget(selector, x, y)}` }] };
    },
  );

  server.registerTool(
    'human_rightClick',
    {
      title: 'Right-click (humanized)',
      description:
        'Right-clicks the target to open a context menu. Same motion as human_click; only the dispatched button differs. Target is a selector OR x/y coordinates.',
      inputSchema: { ...targetFields, session: sessionArg },
    },
    async ({ selector, x, y, session }) => {
      const { human } = await sessions.get(session);
      const target = resolveTarget({ selector, x, y });
      await human.rightClick(target);
      return {
        content: [{ type: 'text', text: `right-clicked ${describeTarget(selector, x, y)}` }],
      };
    },
  );

  server.registerTool(
    'human_hover',
    {
      title: 'Hover an element (humanized)',
      description:
        'Moves the cursor to an element and settles on it (no click), letting hover-triggered UI fire — tooltips, dropdowns. Element-bound only; for positioning the cursor at coordinates without an element, use human_move.',
      inputSchema: {
        selector: z.string().describe('Selector of the element to hover.'),
        session: sessionArg,
      },
    },
    async ({ selector, session }) => {
      const { human } = await sessions.get(session);
      await human.hover(selector);
      return { content: [{ type: 'text', text: `hovered ${selector}` }] };
    },
  );

  server.registerTool(
    'human_move',
    {
      title: 'Move the cursor (humanized)',
      description:
        'Moves the cursor to a target along a Bezier path with no click and no settle dwell — pure positioning. Useful before a keyboard action, for canvas work, or cinematic beats. Target is a selector OR x/y coordinates.',
      inputSchema: { ...targetFields, session: sessionArg },
    },
    async ({ selector, x, y, session }) => {
      const { human } = await sessions.get(session);
      const target = resolveTarget({ selector, x, y });
      await human.move(target);
      return { content: [{ type: 'text', text: `moved to ${describeTarget(selector, x, y)}` }] };
    },
  );

  server.registerTool(
    'human_drag',
    {
      title: 'Drag (humanized)',
      description:
        'Drags from one location to another — cursor → source, mousedown, source → destination, mouseup, all humanized. Each endpoint is a selector OR x/y coordinates (use coordinates for sliders, canvas, SVG handles).',
      inputSchema: {
        fromSelector: z
          .string()
          .optional()
          .describe('Source selector. Provide this OR fromX/fromY.'),
        fromX: z.number().optional().describe('Source X coordinate. Requires fromY.'),
        fromY: z.number().optional().describe('Source Y coordinate. Requires fromX.'),
        toSelector: z
          .string()
          .optional()
          .describe('Destination selector. Provide this OR toX/toY.'),
        toX: z.number().optional().describe('Destination X coordinate. Requires toY.'),
        toY: z.number().optional().describe('Destination Y coordinate. Requires toX.'),
        session: sessionArg,
      },
    },
    async ({ fromSelector, fromX, fromY, toSelector, toX, toY, session }) => {
      const { human } = await sessions.get(session);
      const from = resolveTarget({ selector: fromSelector, x: fromX, y: fromY });
      const to = resolveTarget({ selector: toSelector, x: toX, y: toY });
      await human.drag(from, to);
      return {
        content: [
          {
            type: 'text',
            text: `dragged ${describeTarget(fromSelector, fromX, fromY)} → ${describeTarget(toSelector, toX, toY)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'human_type',
    {
      title: 'Type text (humanized)',
      description:
        'Clicks the element to focus it, then types with humanized per-key rhythm. The current personality controls speed, typo probability, and corrections (HUMANJS_PERSONALITY / human_set_personality). If this types into a search/filter, the results re-render (often debounced) — call human_wait or human_wait_for_load before targeting a result, and use a specific selector (the list shifts as it filters).',
      inputSchema: {
        selector: z.string().describe('Selector of the input/textarea/contenteditable.'),
        value: z.string().describe('Text to type. May contain newlines.'),
        session: sessionArg,
      },
    },
    async ({ selector, value, session }) => {
      const { human } = await sessions.get(session);
      await human.type(selector, value);
      return { content: [{ type: 'text', text: `typed ${value.length} chars into ${selector}` }] };
    },
  );

  server.registerTool(
    'human_paste',
    {
      title: 'Paste text (one shot)',
      description:
        'Inserts text in one shot (the Cmd-V semantic) — focuses the field, then sets the whole value via insertText with no per-key timing. Use for long strings where humanized typing would be slow. Does not fire the page paste event.',
      inputSchema: {
        selector: z.string().describe('Selector of the field to paste into.'),
        value: z.string().describe('Text to insert.'),
        session: sessionArg,
      },
    },
    async ({ selector, value, session }) => {
      const { human } = await sessions.get(session);
      await human.paste(selector, value);
      return { content: [{ type: 'text', text: `pasted ${value.length} chars into ${selector}` }] };
    },
  );

  server.registerTool(
    'human_press',
    {
      title: 'Press a key or chord',
      description:
        'Presses a single key (Enter, Tab, Escape, ArrowDown, …) or a chord (Mod+S, Cmd+Shift+P, Ctrl+C). "Mod" maps to Meta on Mac and Control elsewhere. Dispatches against focus — does not move the cursor; compose with human_click/human_move when you need both.',
      inputSchema: {
        key: z.string().describe('Key or chord, e.g. "Enter", "Tab", "Mod+S", "Ctrl+Shift+K".'),
        session: sessionArg,
      },
    },
    async ({ key, session }) => {
      const { human } = await sessions.get(session);
      // The library types `key` as a KeyOrChord template-literal union for
      // IDE autocomplete; any string still typechecks through its escape
      // hatch, and the library validates modifiers at runtime. MCP input is
      // a plain string, so the cast just selects that escape-hatch arm.
      await human.press(key as Parameters<typeof human.press>[0]);
      return { content: [{ type: 'text', text: `pressed ${key}` }] };
    },
  );

  server.registerTool(
    'human_scroll',
    {
      title: 'Scroll (humanized)',
      description:
        'Scrolls the page or a container with a natural velocity profile. Default scrolls one viewport down. Use `target` for presets ("natural"/"end"/"top") or an element selector to scroll into view; `by` for a relative pixel delta; `to` for an absolute position.',
      inputSchema: {
        target: z
          .string()
          .optional()
          .describe(
            'One of "natural" (one viewport), "end", "top", or an element selector to scroll until visible. Defaults to "natural". Ignored if `by` or `to` is set.',
          ),
        by: z.number().optional().describe('Relative pixel delta (negative = up/left).'),
        to: z.number().optional().describe('Absolute scroll position on the chosen axis.'),
        axis: z.enum(['x', 'y']).optional().describe('Axis to scroll. Defaults to "y".'),
        within: z
          .string()
          .optional()
          .describe('Selector of a scrollable container to scope the scroll to.'),
        session: sessionArg,
      },
    },
    async ({ target, by, to, axis, within, session }) => {
      const { human } = await sessions.get(session);
      const scrollTarget =
        by !== undefined ? { by } : to !== undefined ? { to } : (target ?? 'natural');
      const result = await human.scroll(scrollTarget, { axis, within });
      return {
        content: [
          { type: 'text', text: `scrolled ${result.from} → ${result.to} (${result.distance}px)` },
        ],
      };
    },
  );

  server.registerTool(
    'human_read',
    {
      title: 'Read dwell (humanized)',
      description:
        'Dwells as if reading the target — pause time derived from word count and the personality\'s reading speed, with a visible cursor scan across the text. Models the "user pauses to read" beat. Provide a selector OR literal text.',
      inputSchema: {
        selector: z
          .string()
          .optional()
          .describe('Selector of the text to read. Provide this OR text.'),
        text: z
          .string()
          .optional()
          .describe('Literal text to "read" (no DOM lookup). Provide this OR selector.'),
        kind: z
          .enum(['prose', 'code', 'scan'])
          .optional()
          .describe('Reading style. Auto-detected as "code" for <pre>/<code> when omitted.'),
        session: sessionArg,
      },
    },
    async ({ selector, text, kind, session }) => {
      const { human } = await sessions.get(session);
      if (selector === undefined && text === undefined) {
        throw new Error('Provide a selector or text to read.');
      }
      const readTarget = text !== undefined ? { text } : (selector as string);
      const result = await human.read(readTarget, { kind });
      return {
        content: [
          {
            type: 'text',
            text: `read ${result.words} words (${result.kind}) over ${result.durationMs}ms`,
          },
        ],
      };
    },
  );
}

/** Short human-readable description of a selector-or-point target. */
function describeTarget(selector?: string, x?: number, y?: number): string {
  if (selector !== undefined) return selector;
  if (x !== undefined && y !== undefined) return `(${x}, ${y})`;
  return 'target';
}
