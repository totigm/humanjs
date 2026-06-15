import {
  generateHumanJS,
  generatePlaywrightTest,
  type PlaywrightTestOptions,
  type Timeline,
  type TimelineEvent,
} from '@humanjs/playwright';

export type ExportFormat = 'spec' | 'script';

export interface ExportOptions {
  /** `spec` → a `@humanjs/playwright/test` spec; `script` → a standalone HumanJS script. */
  readonly format: ExportFormat;
  readonly personality?: string;
  readonly seed?: string | null;
  readonly speed?: string;
  /** Test title (spec only); defaults to the recording name. */
  readonly title?: string;
  /** Extra `generatePlaywrightTest` options (steps / baseUrl / keepSleeps). */
  readonly playwright?: PlaywrightTestOptions;
}

// A `type`/`paste` step flagged secret (`params.secret = 'ENV_NAME'`) exports
// its value as `process.env.ENV_NAME` instead of a literal. We can't make the
// codegen emit a raw identifier directly, so we route the value through a
// sentinel string and unquote it in the generated output.
const ENV_PREFIX = '__HUMANJS_ENV__';
const ENV_SENTINEL_RE = /['"]__HUMANJS_ENV__([A-Za-z0-9_]+)__['"]/g;

function sanitizeEnvName(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, '_');
}

/** Replace the value of secret-flagged type/paste steps with an env sentinel. */
function applySecrets(events: readonly TimelineEvent[]): TimelineEvent[] {
  return events.map((event) => {
    const secret = event.params.secret;
    if ((event.type === 'type' || event.type === 'paste') && typeof secret === 'string' && secret) {
      return { ...event, inputValue: `${ENV_PREFIX}${sanitizeEnvName(secret)}__` };
    }
    return event;
  });
}

function restoreSecrets(code: string): string {
  return code.replace(ENV_SENTINEL_RE, 'process.env.$1');
}

/** Pick the export format from an output filename. `.spec.ts` / `.test.ts` → spec. */
export function formatFromFilename(filename: string): ExportFormat {
  return /\.(spec|test)\.[cm]?tsx?$/i.test(filename) ? 'spec' : 'script';
}

/**
 * Generate code from a captured timeline. Wraps the events in a `Timeline` with
 * the chosen personality/seed/speed and runs the shared `@humanjs/playwright`
 * codegen, then substitutes `process.env.*` for any secret-flagged values.
 */
export function generateCode(events: readonly TimelineEvent[], options: ExportOptions): string {
  const timeline: Timeline = {
    version: 1,
    name: options.title,
    personality: options.personality ?? 'careful',
    seed: options.seed ?? null,
    speed: options.speed ?? 'human',
    durationMs: 0,
    events: applySecrets(events),
  };
  const code =
    options.format === 'script'
      ? generateHumanJS(timeline)
      : generatePlaywrightTest(timeline, options.playwright);
  return restoreSecrets(code);
}
