/**
 * `humanjs run <script>` — execute a HumanJS script with no project setup.
 *
 * The browser, the `Human` instance and (optionally) the recording are
 * wired here, so the script is only the flow:
 *
 *   export default async (human) => {
 *     await human.goto('https://example.com');
 *     await human.click('text=Sign in');
 *   };
 *
 * A named `run` export is accepted too. TypeScript files are loaded
 * through tsx, so a `.ts` script works without a build step — which is
 * the point of running it this way rather than wiring tsx yourself.
 */

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, createHuman, type Human, installMouseHelper } from '@humanjs/playwright';
import { record } from '@humanjs/recorder';
import type { Page } from 'playwright';
import { type CliOptions, UsageError } from '../args';

/** The shape a script is expected to export. */
export type Flow = (human: Human, page: Page) => Promise<void> | void;

interface FlowModule {
  readonly default?: unknown;
  readonly run?: unknown;
}

/**
 * Picks the exported flow, preferring `default` and falling back to a
 * named `run`. The error path matters: "your file exported nothing
 * callable" is the single most likely mistake, so it says exactly what
 * shape was expected instead of failing with `x is not a function`.
 */
export function selectFlow(module: FlowModule, path: string): Flow {
  const candidate = module.default ?? module.run;
  if (typeof candidate !== 'function') {
    throw new UsageError(
      `${path} does not export a flow. Export an async function as the default export (or as \`run\`):\n\n` +
        `  export default async (human) => {\n` +
        `    await human.goto('https://example.com');\n` +
        `  };`,
    );
  }
  return candidate as Flow;
}

async function loadFlow(path: string): Promise<Flow> {
  const absolute = resolve(path);
  try {
    await access(absolute);
  } catch {
    throw new UsageError(`Script not found: ${absolute}`);
  }

  if (/\.[cm]?tsx?$/.test(absolute)) {
    // tsx registers a loader hook for the rest of the process; only paid
    // for when the script actually is TypeScript.
    const { register } = await import('tsx/esm/api');
    register();
  }

  const module = (await import(pathToFileURL(absolute).href)) as FlowModule;
  return selectFlow(module, path);
}

export async function runScript(path: string, options: CliOptions): Promise<void> {
  const flow = await loadFlow(path);
  const { personality, speed, seed, headless, viewport, record: output } = options;

  if (output) {
    const rec = await record(
      { output, name: `humanjs run ${path}`, personality, seed, viewport, headless },
      async (human, page) => {
        await flow(human, page);
      },
    );
    console.log(`Recorded ${rec.timeline.events.length} actions to ${output}`);
    return;
  }

  const browser = await chromium.launch({ headless });
  try {
    const context = await browser.newContext({ viewport });
    await installMouseHelper(context);
    const page = await context.newPage();
    const human = await createHuman(page, { personality, speed, seed });
    await flow(human, page);
  } finally {
    await browser.close();
  }
}
