import { describe, expect, it } from 'vitest';
import { careful } from '../presets';
import { createRng } from '../rng';
import { computeReadingDwellMs, countWords } from './index';

const NO_JITTER = { wpm: 250, jitter: 0 };

describe('countWords', () => {
  it('returns 0 for empty / whitespace-only strings', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('\n\t  \n')).toBe(0);
  });

  it('counts whitespace-separated tokens', () => {
    expect(countWords('hello')).toBe(1);
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one  two   three')).toBe(3);
    expect(countWords('  leading and trailing  ')).toBe(3);
  });

  it('treats line breaks and tabs as separators', () => {
    expect(countWords('line one\nline two')).toBe(4);
    expect(countWords('a\tb\tc')).toBe(3);
  });
});

describe('computeReadingDwellMs', () => {
  it('returns 0 for zero or negative word counts', () => {
    expect(computeReadingDwellMs(0, NO_JITTER, createRng('z'))).toBe(0);
    expect(computeReadingDwellMs(-5, NO_JITTER, createRng('z'))).toBe(0);
  });

  it('produces (words / wpm) × 60000 ms with no jitter / no scaling (prose default)', () => {
    // 60 words / 250 wpm = 0.24 min = 14_400 ms
    const ms = computeReadingDwellMs(60, NO_JITTER, createRng('plain'));
    expect(ms).toBeCloseTo(14_400);
  });

  it('applies the code kind multiplier (0.4×) → slower dwell', () => {
    const prose = computeReadingDwellMs(60, NO_JITTER, createRng('a'), { kind: 'prose' });
    const code = computeReadingDwellMs(60, NO_JITTER, createRng('a'), { kind: 'code' });
    // code is slower (lower effective WPM → longer dwell)
    expect(code).toBeCloseTo(prose / 0.4);
  });

  it('applies the scan kind multiplier (1.8×) → faster dwell', () => {
    const prose = computeReadingDwellMs(60, NO_JITTER, createRng('a'), { kind: 'prose' });
    const scan = computeReadingDwellMs(60, NO_JITTER, createRng('a'), { kind: 'scan' });
    expect(scan).toBeCloseTo(prose / 1.8);
  });

  it('wpmMultiplier overrides kind when both are provided', () => {
    const ms = computeReadingDwellMs(60, NO_JITTER, createRng('a'), {
      kind: 'code', // would normally use 0.4×
      wpmMultiplier: 2, // explicit override
    });
    // 60 / (250 × 2) × 60000 = 60 / 500 × 60000 = 7200
    expect(ms).toBeCloseTo(7_200);
  });

  it('scales by personalitySpeed and speedFactor multiplicatively', () => {
    const base = computeReadingDwellMs(60, NO_JITTER, createRng('a'));
    const halfSpeed = computeReadingDwellMs(60, NO_JITTER, createRng('a'), {
      personalitySpeed: 0.5,
    });
    const halfBoth = computeReadingDwellMs(60, NO_JITTER, createRng('a'), {
      personalitySpeed: 0.5,
      speedFactor: 0.5,
    });
    expect(halfSpeed).toBeCloseTo(base * 0.5);
    expect(halfBoth).toBeCloseTo(base * 0.25);
  });

  it('returns 0 in instant mode (speedFactor: 0)', () => {
    const ms = computeReadingDwellMs(60, careful.reading, createRng('i'), { speedFactor: 0 });
    expect(ms).toBe(0);
  });

  it('is deterministic for the same seed and inputs', () => {
    const opts = { kind: 'prose' as const, personalitySpeed: 1, speedFactor: 1 };
    const a = computeReadingDwellMs(120, careful.reading, createRng('rd-1'), opts);
    const b = computeReadingDwellMs(120, careful.reading, createRng('rd-1'), opts);
    expect(a).toBe(b);
  });

  it('produces different dwells for different seeds (jitter consumes RNG)', () => {
    const a = computeReadingDwellMs(120, careful.reading, createRng('rd-a'));
    const b = computeReadingDwellMs(120, careful.reading, createRng('rd-b'));
    expect(a).not.toBe(b);
  });
});
