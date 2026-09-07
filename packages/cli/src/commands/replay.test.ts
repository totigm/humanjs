import { describe, expect, it } from 'vitest';
import { PERSONALITIES, SPEEDS } from '../args';
import { formatDuration, formatSummary, resolveSetting } from './replay';

describe('resolveSetting', () => {
  it('prefers the flag the user passed', () => {
    expect(resolveSetting('fast', 'distracted', PERSONALITIES, 'careful')).toBe('fast');
  });

  it('falls back to what the timeline was recorded with', () => {
    // The point of the command: a timeline captured as `distracted`
    // replays differently under `careful`, so reproducing beats defaulting.
    expect(resolveSetting(undefined, 'distracted', PERSONALITIES, 'careful')).toBe('distracted');
  });

  it('falls back to the default when the timeline says nothing', () => {
    expect(resolveSetting(undefined, undefined, PERSONALITIES, 'careful')).toBe('careful');
  });

  it('ignores a recorded value that is not a known option', () => {
    // Timelines are files on disk; a hand-edited or future one must not
    // be forwarded into the library unchecked.
    expect(resolveSetting(undefined, 'grandma', PERSONALITIES, 'careful')).toBe('careful');
  });

  it('works the same for speeds', () => {
    expect(resolveSetting(undefined, 'instant', SPEEDS, 'human')).toBe('instant');
  });
});

describe('formatDuration', () => {
  it('uses ms below a second', () => {
    expect(formatDuration(840)).toBe('840ms');
  });

  it('switches to seconds at a second', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(18340)).toBe('18.3s');
  });
});

describe('formatSummary', () => {
  const pass = (index: number, type: string) => ({ index, type, status: 'pass' as const });

  it('reports a clean run', () => {
    expect(formatSummary([pass(0, 'goto'), pass(1, 'click')], 2, 18340)).toBe(
      'PASS  2 steps · 18.3s',
    );
  });

  it('does not pluralise a single step', () => {
    expect(formatSummary([pass(0, 'goto')], 1, 500)).toBe('PASS  1 step · 500ms');
  });

  it('names the failing step in one-based terms, as printed', () => {
    const steps = [
      pass(0, 'goto'),
      { index: 1, type: 'type', status: 'fail' as const, error: 'x' },
    ];
    // The reader is looking at "✗  2  type" above; the summary has to agree.
    expect(formatSummary(steps, 12, 4200)).toBe('FAIL  step 2 of 12 (type) · 4.2s');
  });
});
