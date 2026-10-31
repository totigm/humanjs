import { describe, expect, it } from 'vitest';
import { parseArgs, parseViewport, parseViewportList, UsageError } from './args';

describe('parseArgs', () => {
  it('defaults to help with no arguments', () => {
    expect(parseArgs([]).command).toBe('help');
  });

  it('reads the command and its target', () => {
    const parsed = parseArgs(['demo', 'https://example.com']);
    expect(parsed.command).toBe('demo');
    expect(parsed.target).toBe('https://example.com');
  });

  it('runs headed by default — the point of demo is watching it', () => {
    expect(parseArgs(['demo', 'https://example.com']).options.headless).toBe(false);
  });

  it('accepts --flag value and --flag=value alike', () => {
    const spaced = parseArgs(['demo', 'u', '--personality', 'fast']);
    const inline = parseArgs(['demo', 'u', '--personality=fast']);
    expect(spaced.options.personality).toBe('fast');
    expect(inline.options.personality).toBe('fast');
  });

  it('lets --headless override the default', () => {
    expect(parseArgs(['run', 'f.ts', '--headless']).options.headless).toBe(true);
  });

  it('collects every option in one pass', () => {
    const { options } = parseArgs([
      'run',
      'flow.ts',
      '--speed=fast',
      '--seed=abc',
      '--record=out.gif',
      '--viewport=800x600',
    ]);
    expect(options.speed).toBe('fast');
    expect(options.seed).toBe('abc');
    expect(options.record).toBe('out.gif');
    expect(options.viewport).toEqual({ width: 800, height: 600 });
  });

  it('parses --timeout as milliseconds', () => {
    expect(parseArgs(['replay', 'f.json', '--timeout', '5000']).options.timeoutMs).toBe(5000);
  });

  it('leaves timeoutMs undefined so Playwright keeps its own default', () => {
    expect(parseArgs(['replay', 'f.json']).options.timeoutMs).toBeUndefined();
  });

  it.each([['0'], ['abc'], ['-1']])('rejects --timeout=%s', (bad) => {
    expect(() => parseArgs(['replay', 'f.json', `--timeout=${bad}`])).toThrow(/Invalid --timeout/);
  });

  it('treats a bare negative as a missing value, since it looks like a flag', () => {
    expect(() => parseArgs(['replay', 'f.json', '--timeout', '-1'])).toThrow(
      /--timeout needs a value/,
    );
  });

  it('accepts replay as a command', () => {
    expect(parseArgs(['replay', 'flow.json']).command).toBe('replay');
  });

  it('accepts compare as a command', () => {
    expect(parseArgs(['compare', 'https://example.com']).command).toBe('compare');
  });

  it('accepts check as a command', () => {
    expect(parseArgs(['check', 'https://example.com']).command).toBe('check');
  });

  it('parses the media emulation flags', () => {
    const { options } = parseArgs([
      'demo',
      'u',
      '--reduced-motion',
      '--color-scheme=dark',
      '--forced-colors',
    ]);
    expect(options.reducedMotion).toBe(true);
    expect(options.colorScheme).toBe('dark');
    expect(options.forcedColors).toBe(true);
  });

  it('rejects a colour scheme that is not light or dark', () => {
    expect(() => parseArgs(['demo', 'u', '--color-scheme', 'sepia'])).toThrow(
      /Unknown --color-scheme "sepia".*light, dark/s,
    );
  });

  it('reads --out for check output', () => {
    expect(parseArgs(['check', 'u', '--out', 'shots']).options.outDir).toBe('shots');
  });

  it('leaves personality and speed unset when not passed', () => {
    // replay reads this to tell "not specified" from "set to the default",
    // so it can honour what the timeline recorded.
    const { options } = parseArgs(['replay', 'f.json']);
    expect(options.personality).toBeUndefined();
    expect(options.speed).toBeUndefined();
  });

  it.each([['-h'], ['--help']])('treats %s as the help command', (flag) => {
    expect(parseArgs([flag]).command).toBe('help');
  });

  it.each([['-v'], ['--version']])('treats %s as the version command', (flag) => {
    expect(parseArgs([flag]).command).toBe('version');
  });

  describe('rejections name the bad value and the alternatives', () => {
    it('rejects an unknown command', () => {
      expect(() => parseArgs(['recrod'])).toThrow(
        /Unknown command "recrod".*demo, compare, check, run, replay/s,
      );
    });

    it('rejects an unknown personality', () => {
      expect(() => parseArgs(['demo', 'u', '--personality', 'grandma'])).toThrow(
        /Unknown --personality "grandma".*careful, fast, distracted, precise/s,
      );
    });

    it('rejects an unknown speed', () => {
      expect(() => parseArgs(['demo', 'u', '--speed', 'turbo'])).toThrow(/human, fast, instant/);
    });

    it('rejects an unknown flag and points at help', () => {
      expect(() => parseArgs(['demo', 'u', '--fast'])).toThrow(
        /Unknown flag "--fast".*humanjs help/s,
      );
    });

    it('rejects a flag with no value', () => {
      expect(() => parseArgs(['demo', 'u', '--seed'])).toThrow(/--seed needs a value/);
    });

    it('does not swallow the next flag as a value', () => {
      expect(() => parseArgs(['demo', 'u', '--seed', '--headless'])).toThrow(
        /--seed needs a value/,
      );
    });

    it('rejects a third positional argument', () => {
      expect(() => parseArgs(['demo', 'a', 'b'])).toThrow(/Unexpected extra argument "b"/);
    });

    it('throws UsageError, so the entry point can skip the stack trace', () => {
      expect(() => parseArgs(['nope'])).toThrow(UsageError);
    });
  });
});

describe('parseViewport', () => {
  it('parses WIDTHxHEIGHT', () => {
    expect(parseViewport('1440x900')).toEqual({ width: 1440, height: 900 });
  });

  it('accepts the multiplication sign, which is what design tools copy', () => {
    expect(parseViewport('390×844')).toEqual({ width: 390, height: 844 });
  });

  it('tolerates spaces around the separator', () => {
    expect(parseViewport(' 800 x 600 ')).toEqual({ width: 800, height: 600 });
  });

  it.each([['1440'], ['1440x'], ['axb'], ['0x600'], ['-1x9']])(
    'rejects %s with an example of the right shape',
    (bad) => {
      expect(() => parseViewport(bad)).toThrow(/--viewport/);
    },
  );
});

describe('parseViewportList', () => {
  it('parses a single size into a one-entry list', () => {
    expect(parseViewportList('1440x900')).toEqual([{ width: 1440, height: 900 }]);
  });

  it('parses a comma-separated sweep', () => {
    expect(parseViewportList('1440x900,390x844')).toEqual([
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]);
  });

  it('collapses duplicates, since running a size twice writes the same file twice', () => {
    expect(parseViewportList('800x600,800x600')).toHaveLength(1);
  });

  it('rejects the whole list when one entry is malformed', () => {
    expect(() => parseViewportList('1440x900,nope')).toThrow(/--viewport/);
  });
});

describe('parseArgs viewports', () => {
  it('defaults to exactly one viewport', () => {
    expect(parseArgs(['demo', 'u']).viewports).toHaveLength(1);
  });

  it('exposes every requested size', () => {
    expect(parseArgs(['demo', 'u', '--viewport', '1440x900,390x844']).viewports).toHaveLength(2);
  });

  it('keeps options.viewport pointing at the first, for single-size callers', () => {
    const parsed = parseArgs(['demo', 'u', '--viewport=1440x900,390x844']);
    expect(parsed.options.viewport).toEqual({ width: 1440, height: 900 });
  });
});
