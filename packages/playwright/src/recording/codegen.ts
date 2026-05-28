import type { Timeline, TimelineEvent } from './index';

// A raw-coordinate target (`point(x, y)`) has no selector, so generated code
// keeps the coordinate verbatim and flags it — converting it to a guessed
// locator would silently change behavior (canvas/map/pixel-precise clicks).
const POINT_RE = /^point\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;
const POINT_COMMENT = ' // raw coordinate — replace with a locator for a stable selector';
const UNCAPTURED_COMMENT = ' // input not captured (masked or captureInputs disabled) — fill in';

/** Single-quoted JS string literal, escaped. */
function q(value: unknown): string {
  return `'${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;
}

/** Render a mouse-target description as a call argument. */
function targetArg(desc: unknown): { code: string; isPoint: boolean } {
  const s = String(desc ?? '');
  const m = s.match(POINT_RE);
  if (m) return { code: `{ x: ${m[1]}, y: ${m[2]} }`, isPoint: true };
  return { code: q(s), isPoint: false };
}

/** `createHuman` options block, reconstructed from the timeline metadata. */
function createHumanOptions(timeline: Timeline): string {
  const parts = [`    personality: ${q(timeline.personality)},`];
  if (timeline.seed !== null) parts.push(`    seed: ${q(timeline.seed)},`);
  parts.push(`    speed: ${q(timeline.speed)},`);
  return `{\n${parts.join('\n')}\n  }`;
}

function emitScroll(target: unknown): string {
  const s = String(target ?? 'natural');
  if (s === 'natural') return "  await human.scroll('natural');";
  const by = s.match(/^by:(-?\d+(?:\.\d+)?)$/);
  if (by) return `  await human.scroll({ by: ${by[1]} });`;
  const to = s.match(/^to:(-?\d+(?:\.\d+)?)$/);
  if (to) return `  await human.scroll({ to: ${to[1]} });`;
  return `  await human.scroll(${q(s)});`;
}

/**
 * Map one timeline event to generated code. When `asserts` is on (test
 * export), append the assertions we can safely derive from recorded state:
 * a read implies the target was visible; a captured input implies its value.
 */
function emitAction(e: TimelineEvent, asserts = false): string {
  const p = e.params;
  switch (e.type) {
    case 'goto':
      return `  await human.goto(${q(p.url)});`;
    case 'click':
    case 'rightClick':
    case 'hover':
    case 'move': {
      const { code, isPoint } = targetArg(p.target);
      return `  await human.${e.type}(${code});${isPoint ? POINT_COMMENT : ''}`;
    }
    case 'drag': {
      const from = targetArg(p.from);
      const to = targetArg(p.to);
      const comment = from.isPoint || to.isPoint ? POINT_COMMENT : '';
      return `  await human.drag(${from.code}, ${to.code});${comment}`;
    }
    case 'type':
    case 'paste': {
      const { code, isPoint } = targetArg(p.target);
      if (e.inputValue === undefined) {
        return `  await human.${e.type}(${code}, '');${UNCAPTURED_COMMENT}`;
      }
      const call = `  await human.${e.type}(${code}, ${q(e.inputValue)});`;
      if (asserts && !isPoint) {
        return `${call}\n  await expect(page.locator(${code})).toHaveValue(${q(e.inputValue)});`;
      }
      return call;
    }
    case 'press':
      return `  await human.press(${q(p.key)});`;
    case 'scroll':
      return emitScroll(p.target);
    case 'read': {
      // Reads driven by word-count or raw text don't carry a selector, and
      // the text itself is never recorded — emit a note instead of broken code.
      const desc = String(p.target ?? '');
      if (/^\d+ words$/.test(desc) || /^text:\d+ chars$/.test(desc)) {
        return `  // human.read(...) — ${desc}; original target not captured`;
      }
      const call = `  await human.read(${q(desc)});`;
      if (asserts) return `${call}\n  await expect(page.locator(${q(desc)})).toBeVisible();`;
      return call;
    }
    case 'sleep':
      return `  await sleep(${Number(p.ms) || 0});`;
    case 'reload':
      return '  await human.reload();';
    case 'goBack':
      return '  await human.goBack();';
    case 'goForward':
      return '  await human.goForward();';
    default:
      return `  // unsupported action: ${e.type}`;
  }
}

function needsSleepImport(timeline: Timeline): boolean {
  return timeline.events.some((e) => e.type === 'sleep');
}

/**
 * Generates a standalone, runnable HumanJS script that replays the recorded
 * session. String selectors round-trip verbatim; raw coordinates and
 * un-captured inputs are emitted with a flag so they're easy to fix up.
 */
export function generateHumanJS(timeline: Timeline): string {
  const imports = needsSleepImport(timeline)
    ? "import { chromium, createHuman, sleep } from '@humanjs/playwright';"
    : "import { chromium, createHuman } from '@humanjs/playwright';";
  const body = timeline.events.map((e) => emitAction(e)).join('\n');
  return `${imports}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const human = await createHuman(page, ${createHumanOptions(timeline)});

${body}

  await browser.close();
}

main();
`;
}

/**
 * Generates a `@playwright/test` spec that replays the session through
 * HumanJS — a humanized test, not raw Playwright, since the humanization is
 * the point. Same action mapping as {@link generateHumanJS}, test scaffold.
 */
export function generatePlaywrightTest(timeline: Timeline): string {
  const body = timeline.events.map((e) => emitAction(e, true)).join('\n');
  // Only import `expect` if we actually emitted assertions — otherwise the
  // generated file carries an unused import.
  const hasAsserts = /^ {2}await expect\(/m.test(body);
  const testImport = hasAsserts
    ? "import { expect, test } from '@playwright/test';"
    : "import { test } from '@playwright/test';";
  const humanImport = needsSleepImport(timeline)
    ? "import { createHuman, sleep } from '@humanjs/playwright';"
    : "import { createHuman } from '@humanjs/playwright';";
  // Outcome assertions (URL, text appeared, …) can't be derived from recorded
  // actions, so leave a guided placeholder instead of guessing them.
  const todo = [
    hasAsserts
      ? '  // TODO: add assertions for the outcome of this flow, e.g.:'
      : "  // TODO: assert the outcome — import { expect } from '@playwright/test', e.g.:",
    '  //   await expect(page).toHaveURL(/dashboard/);',
    "  //   await expect(page.getByText('Welcome back')).toBeVisible();",
  ].join('\n');
  return `${testImport}
${humanImport}

test('recorded session', async ({ page }) => {
  const human = await createHuman(page, ${createHumanOptions(timeline)});

${body}

${todo}
});
`;
}
