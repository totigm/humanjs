import { describe, expect, it } from 'vitest';
import { parseArgs, parseViewport, UsageError } from './args';

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

  it.each([['-h'], ['--help']])('treats %s as the help command', (flag) => {
    expect(parseArgs([flag]).command).toBe('help');
  });

  it.each([['-v'], ['--version']])('treats %s as the version command', (flag) => {
    expect(parseArgs([flag]).command).toBe('version');
  });

  describe('rejections name the bad value and the alternatives', () => {
    it('rejects an unknown command', () => {
      expect(() => parseArgs(['recrod'])).toThrow(/Unknown command "recrod".*demo, run/s);
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
