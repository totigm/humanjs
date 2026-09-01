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

export type CommandName = 'demo' | 'run' | 'help' | 'version';

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface CliOptions {
  readonly personality: Personality;
  readonly speed: SpeedName;
  readonly seed?: string;
  readonly headless: boolean;
  /** Output file for a recording; the extension picks the format. */
  readonly record?: string;
  readonly viewport: Viewport;
}

export interface ParsedArgs {
  readonly command: CommandName;
  /** URL for `demo`, script path for `run`. */
  readonly target?: string;
  readonly options: CliOptions;
}

const DEFAULTS: CliOptions = {
  personality: 'careful',
  speed: 'human',
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

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;

    if (!arg.startsWith('-')) {
      if (command === undefined) {
        command = oneOf(arg, ['demo', 'run', 'help', 'version'] as const, 'command');
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
      case '--viewport': {
        const { value, nextIndex } = takeValue(name, inline, argv, i);
        i = nextIndex;
        options = { ...options, viewport: parseViewport(value) };
        break;
      }
      default:
        throw new UsageError(`Unknown flag "${name}". Run \`humanjs help\` to see the options.`);
    }
  }

  return { command: command ?? 'help', target, options };
}

function splitFlag(arg: string): [string, string | undefined] {
  const eq = arg.indexOf('=');
  if (eq === -1) return [arg, undefined];
  return [arg.slice(0, eq), arg.slice(eq + 1)];
}
