/**
 * Argument parsing for the `humanjs` command.
 *
 * Hand-rolled rather than pulled from a library: the surface is two
 * commands and seven flags, and keeping it dependency-free means the
 * parser is fully unit-testable — which matters more here than anywhere
 * else in the repo, because on a CLI the error messages *are* the
 * interface. Every rejection below names the offending value and lists
 * what was expected instead.
 */

/** Humanization presets accepted by `--personality`. */
export const PERSONALITIES = ['careful', 'fast', 'distracted', 'precise'] as const;
export type Personality = (typeof PERSONALITIES)[number];

/** Paces accepted by `--speed`. */
export const SPEEDS = ['human', 'fast', 'instant'] as const;
export type SpeedName = (typeof SPEEDS)[number];

export type CommandName = 'demo' | 'compare' | 'check' | 'run' | 'replay' | 'help' | 'version';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface CliOptions {
  /**
   * Left undefined when the user did not pass the flag, so a command can
   * tell "not specified" from "explicitly set to the default". `replay`
   * relies on it: a timeline records the personality and speed it was
   * captured with, and reproducing those beats imposing a fresh default.
   */
  readonly personality?: Personality;
  readonly speed?: SpeedName;
  readonly seed?: string;
  readonly headless: boolean;
  /** Default Playwright timeout in ms. Undefined leaves Playwright's own. */
  readonly timeoutMs?: number;
  /** Render under `prefers-reduced-motion: reduce`. */
  readonly reducedMotion?: boolean;
  /** Render under `prefers-color-scheme`. */
  readonly colorScheme?: 'light' | 'dark';
  /** Render under `forced-colors: active` (Windows High Contrast). */
  readonly forcedColors?: boolean;
  /** Directory for `check` output. */
  readonly outDir?: string;
  /** Output file for a recording; the extension picks the format. */
  readonly record?: string;
  readonly viewport: Viewport;
}

export interface ParsedArgs {
  readonly command: CommandName;
  /** URL for `demo`, script path for `run`. */
  readonly target?: string;
  readonly options: CliOptions;
  /**
   * Every size requested. Usually one; `--viewport 1440x900,390x844` runs
   * the command once per entry, which is how a responsive check stops
   * being two invocations a person has to remember to keep in sync.
   */
  readonly viewports: readonly Viewport[];
}

/** Applied when a command has no better answer of its own. */
export const DEFAULT_PERSONALITY: Personality = 'careful';
export const DEFAULT_SPEED: SpeedName = 'human';

const DEFAULTS: CliOptions = {
  // Headed by default and on purpose: the whole point of `demo` is to
  // watch it. A headless default would make the first run look like it
  // did nothing.
  headless: false,
  viewport: { width: 1280, height: 800 },
};

/** Raised for anything the user can fix by retyping the command. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

function oneOf<T extends string>(value: string, allowed: readonly T[], flag: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new UsageError(`Unknown ${flag} "${value}". Expected one of: ${allowed.join(', ')}.`);
}

/**
 * Parses a comma-separated list of `WIDTHxHEIGHT`, e.g.
 * `1440x900,390x844`. Duplicates are collapsed — running the same size
 * twice writes the same file twice and helps nobody.
 */
export function parseViewportList(value: string): Viewport[] {
  const seen = new Set<string>();
  const viewports: Viewport[] = [];
  for (const part of value.split(',')) {
    const viewport = parseViewport(part);
    const key = `${viewport.width}x${viewport.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    viewports.push(viewport);
  }
  return viewports;
}

/**
 * Parses `WIDTHxHEIGHT`. Accepts the ASCII `x` and the multiplication
 * sign, because `1280×800` is what a person copying from a design tool
 * will actually paste.
 */
export function parseViewport(value: string): Viewport {
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(value.trim());
  if (!match) {
    throw new UsageError(`Invalid --viewport "${value}". Expected WIDTHxHEIGHT, e.g. 1280x800.`);
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 1 || height < 1) {
    throw new UsageError(`Invalid --viewport "${value}". Both sides must be at least 1px.`);
  }
  return { width, height };
}

/** Reads the value for a flag, accepting both `--flag value` and `--flag=value`. */
function takeValue(
  flag: string,
  inline: string | undefined,
  argv: readonly string[],
  index: number,
): { value: string; nextIndex: number } {
  if (inline !== undefined) {
    if (inline === '') throw new UsageError(`${flag} needs a value, e.g. ${flag}=something.`);
    return { value: inline, nextIndex: index };
  }
  const next = argv[index + 1];
  if (next === undefined || next.startsWith('-')) {
    throw new UsageError(`${flag} needs a value.`);
  }
  return { value: next, nextIndex: index + 1 };
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let command: CommandName | undefined;
  let target: string | undefined;
  let options: CliOptions = DEFAULTS;
  let viewports: readonly Viewport[] = [DEFAULTS.viewport];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;

    if (!arg.startsWith('-')) {
      if (command === undefined) {
        command = oneOf(
          arg,
          ['demo', 'compare', 'check', 'run', 'replay', 'help', 'version'] as const,
          'command',
        );
      } else if (target === undefined) {
        target = arg;
      } else {
        throw new UsageError(`Unexpected extra argument "${arg}".`);
      }
      continue;
    }

    const [name, inline] = splitFlag(arg);
    switch (name) {
      case '--help':
      case '-h':
        command = 'help';
        break;
      case '--version':
      case '-v':
        command = 'version';
        break;
      case '--headed':
        options = { ...options, headless: false };
        break;
      case '--headless':
        options = { ...options, headless: true };
        break;
      case '--out': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        options = { ...options, outDir: value };
        break;
      }
      case '--reduced-motion':
        options = { ...options, reducedMotion: true };
        break;
      case '--forced-colors':
        options = { ...options, forcedColors: true };
        break;
      case '--color-scheme': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        options = {
          ...options,
          colorScheme: oneOf(value, ['light', 'dark'] as const, '--color-scheme'),
        };
        break;
      }
      case '--personality': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        options = { ...options, personality: oneOf(value, PERSONALITIES, '--personality') };
        break;
      }
      case '--speed': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        options = { ...options, speed: oneOf(value, SPEEDS, '--speed') };
        break;
      }
      case '--seed': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        options = { ...options, seed: value };
        break;
      }
      case '--record': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        options = { ...options, record: value };
        break;
      }
      case '--timeout': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        const ms = Number(value);
        if (!Number.isFinite(ms) || ms <= 0) {
          throw new UsageError(`Invalid --timeout "${value}". Expected milliseconds, e.g. 5000.`);
        }
        options = { ...options, timeoutMs: ms };
        break;
      }
      case '--viewport': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        viewports = parseViewportList(value);
        options = { ...options, viewport: viewports[0] as Viewport };
        break;
      }
      default:
        throw new UsageError(`Unknown flag "${name}". Run \`humanjs help\` to see the options.`);
    }
  }

  return { command: command ?? 'help', target, options, viewports };
}

function splitFlag(arg: string): [string, string | undefined] {
  const eq = arg.indexOf('=');
  if (eq === -1) return [arg, undefined];
  return [arg.slice(0, eq), arg.slice(eq + 1)];
}
