import type { Timeline, TimelineEvent } from './index';

// A raw-coordinate target (`point(x, y)`) has no selector, so generated code
// keeps the coordinate verbatim and flags it — converting it to a guessed
// locator would silently change behavior (canvas/map/pixel-precise clicks).
const POINT_RE = /^point\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$/;
const POINT_COMMENT = ' // raw coordinate — replace with a locator for a stable selector';
const UNCAPTURED_COMMENT =
  ' // input not captured (masked or captureInputs disabled) — fill in (e.g. process.env.X)';

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

/**
 * `createHuman` options block, reconstructed from the timeline metadata.
 * With `ciSpeed`, emits the documented test pattern — instant in CI, the
 * recorded speed locally — so generated tests stay fast in pipelines.
 */
function createHumanOptions(timeline: Timeline, ciSpeed = false): string {
  const parts = [`    personality: ${q(timeline.personality)},`];
  if (timeline.seed !== null) parts.push(`    seed: ${q(timeline.seed)},`);
  parts.push(
    ciSpeed
      ? `    speed: process.env.CI ? 'instant' : ${q(timeline.speed)},`
      : `    speed: ${q(timeline.speed)},`,
  );
  return `{\n${parts.join('\n')}\n  }`;
}

/** Render `selectOption` values (string / string[] / `{value|label|index}`) as a call arg. */
function serializeSelectValues(values: unknown): string {
  if (typeof values === 'string') return q(values);
  if (Array.isArray(values)) {
    return `[${values.map((v) => (typeof v === 'string' ? q(v) : JSON.stringify(v))).join(', ')}]`;
  }
  // Object form ({ value } / { label } / { index }) — JSON is valid JS here.
  return JSON.stringify(values ?? '');
}

/** Render `upload` files (recorded as a path string or array of paths) as a call arg. */
function serializeFiles(files: unknown): string {
  if (Array.isArray(files)) return `[${files.map((f) => q(String(f))).join(', ')}]`;
  return q(String(files ?? ''));
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

interface EmitOptions {
  /** Append safely-derivable assertions (test export). */
  readonly asserts?: boolean;
  /** When set, `goto` URLs under this origin are emitted as relative paths. */
  readonly baseOrigin?: string;
}

/**
 * Map one timeline event to generated code. With `asserts` on (test export),
 * append the assertions we can safely derive from recorded state: a read
 * implies the target was visible; a captured input implies its value.
 */
function emitAction(e: TimelineEvent, opts: EmitOptions = {}): string {
  const p = e.params;
  switch (e.type) {
    case 'goto': {
      const url = String(p.url ?? '');
      if (opts.baseOrigin && url.startsWith(opts.baseOrigin)) {
        return `  await human.goto(${q(url.slice(opts.baseOrigin.length) || '/')});`;
      }
      return `  await human.goto(${q(url)});`;
    }
    case 'click':
    case 'rightClick':
    case 'doubleClick':
    case 'hover':
    case 'move': {
      const { code, isPoint } = targetArg(p.target);
      return `  await human.${e.type}(${code});${isPoint ? POINT_COMMENT : ''}`;
    }
    case 'check':
    case 'uncheck':
    case 'clear':
    case 'selectText': {
      const { code } = targetArg(p.target);
      return `  await human.${e.type}(${code});`;
    }
    case 'selectOption': {
      const { code } = targetArg(p.target);
      return `  await human.selectOption(${code}, ${serializeSelectValues(p.values)});`;
    }
    case 'upload': {
      const { code } = targetArg(p.target);
      return `  await human.upload(${code}, ${serializeFiles(p.files)});`;
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
      if (opts.asserts && !isPoint) {
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
      if (opts.asserts) return `${call}\n  await expect(page.locator(${q(desc)})).toBeVisible();`;
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
    case 'assert': {
      // An explicit assertion (e.g. added in the generator's editor). Test-only:
      // `generateHumanJS` filters these out, since the standalone replay script
      // has no `expect` / `page`.
      const kind = String(p.kind ?? 'visible');
      if (kind === 'url') return `  await expect(page).toHaveURL(${q(p.value)});`;
      const { code } = targetArg(p.target);
      if (kind === 'text')
        return `  await expect(page.locator(${code})).toHaveText(${q(p.value)});`;
      return `  await expect(page.locator(${code})).toBeVisible();`;
    }
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
  // Assertions are a test concept; the standalone replay script drops them.
  const body = timeline.events
    .filter((e) => e.type !== 'assert')
    .map((e) => emitAction(e))
    .join('\n');
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

/** Options for {@link generatePlaywrightTest} / `Recording.toPlaywright`. */
export interface PlaywrightTestOptions {
  /**
   * Keep recorded `sleep()` pauses. Default `false` — a test shouldn't carry
   * human-timing waits (slow + flaky in CI; Playwright auto-waits instead).
   */
  readonly keepSleeps?: boolean;
  /** Test title. Defaults to the recording's name, else `'recorded session'`. */
  readonly title?: string;
  /**
   * Wrap actions in `test.step(...)` groups — a new step per navigation — so
   * they show as collapsible sections in the HTML report / trace. Default false.
   */
  readonly steps?: boolean;
  /**
   * When all `goto`s share one origin, emit them as relative paths and add a
   * note to set `use.baseURL` in the Playwright config (portable across
   * environments). Default false — absolute URLs that run without any config.
   */
  readonly baseUrl?: boolean;
}

const NAV_TYPES = new Set(['goto', 'reload', 'goBack', 'goForward']);

/** The common origin of all `goto`s, or undefined if absent / mixed / relative. */
function sharedGotoOrigin(events: readonly TimelineEvent[]): string | undefined {
  let origin: string | undefined;
  for (const e of events) {
    if (e.type !== 'goto') continue;
    try {
      const o = new URL(String(e.params.url ?? '')).origin;
      if (origin === undefined) origin = o;
      else if (origin !== o) return undefined;
    } catch {
      return undefined;
    }
  }
  return origin;
}

/** Prefix every non-empty line of `block` with `pad`. */
function indentLines(block: string, pad: string): string {
  return block
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}

/** A human-ish label for a `test.step` that begins with `event`. */
function stepLabel(event: TimelineEvent, index: number, baseOrigin?: string): string {
  switch (event.type) {
    case 'goto': {
      const url = String(event.params.url ?? '');
      const path =
        baseOrigin && url.startsWith(baseOrigin) ? url.slice(baseOrigin.length) || '/' : url;
      return `go to ${path}`;
    }
    case 'reload':
      return 'reload';
    case 'goBack':
      return 'go back';
    case 'goForward':
      return 'go forward';
    default:
      return `step ${index + 1}`;
  }
}

/** Group events into `test.step` blocks — a new step begins at each navigation. */
function emitSteps(events: readonly TimelineEvent[], opts: EmitOptions): string {
  const groups: TimelineEvent[][] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last === undefined || NAV_TYPES.has(e.type)) groups.push([e]);
    else last.push(e);
  }
  return groups
    .map((group, i) => {
      const [first] = group;
      const label = first ? stepLabel(first, i, opts.baseOrigin) : `step ${i + 1}`;
      const inner = group.map((e) => indentLines(emitAction(e, opts), '  ')).join('\n');
      return `  await test.step(${q(label)}, async () => {\n${inner}\n  });`;
    })
    .join('\n\n');
}

/**
 * Generates a `@playwright/test` spec that replays the session through
 * HumanJS — a humanized test, not raw Playwright, since the humanization is
 * the point. Uses the `@humanjs/playwright/test` fixture for the `human`
 * (recorded personality / seed / speed applied via `test.use({ humanOptions })`),
 * runs instant in CI / recorded speed locally, drops timing `sleep()`s by
 * default, and derives the assertions it safely can.
 */
export function generatePlaywrightTest(
  timeline: Timeline,
  options: PlaywrightTestOptions = {},
): string {
  // A test shouldn't replay human-timing pauses — drop them unless asked.
  const events = options.keepSleeps
    ? timeline.events
    : timeline.events.filter((e) => e.type !== 'sleep');
  const baseOrigin = options.baseUrl ? sharedGotoOrigin(events) : undefined;
  const emitOpts: EmitOptions = { asserts: true, baseOrigin };
  const body = options.steps
    ? emitSteps(events, emitOpts)
    : events.map((e) => emitAction(e, emitOpts)).join('\n');
  const needsSleep = events.some((e) => e.type === 'sleep');
  // Only import `expect` if we actually emitted assertions (body has no
  // comments yet, so this won't match the TODO placeholder below).
  const hasAsserts = body.includes('await expect(');
  // `test` + `expect` come from the `@humanjs/playwright/test` fixture (which
  // supplies the `human`); only `sleep` (when kept) stays on the package root.
  const fixtureImport = hasAsserts
    ? "import { expect, test } from '@humanjs/playwright/test';"
    : "import { test } from '@humanjs/playwright/test';";
  const sleepImport = needsSleep ? "\nimport { sleep } from '@humanjs/playwright';" : '';
  const title = options.title ?? timeline.name ?? 'recorded session';
  // `page` is only referenced by the derived assertions — omit it from the
  // test args when there are none, so the generated test has no unused fixture.
  const args = hasAsserts ? '{ human, page }' : '{ human }';
  const baseUrlNote = baseOrigin
    ? `  // Set use.baseURL = ${q(baseOrigin)} in playwright.config.ts for these relative paths.\n\n`
    : '';
  // Outcome assertions (URL, text appeared, …) can't be derived from recorded
  // actions, so leave a guided placeholder instead of guessing them.
  const todo = [
    hasAsserts
      ? '  // TODO: add assertions for the outcome of this flow, e.g.:'
      : "  // TODO: assert the outcome — add `page` to the test args and import { expect } from '@humanjs/playwright/test', e.g.:",
    '  //   await expect(page).toHaveURL(/dashboard/);',
    "  //   await expect(page.getByText('Welcome back')).toBeVisible();",
  ].join('\n');
  // Recorded personality / seed / speed are applied via the fixture's
  // `humanOptions` option, so the test still replays with its exact settings
  // (instant in CI) while skipping the per-test createHuman boilerplate.
  return `${fixtureImport}${sleepImport}

test.use({ humanOptions: ${createHumanOptions(timeline, true)} });

test(${q(title)}, async (${args}) => {
${baseUrlNote}${body}

${todo}
});
`;
}
