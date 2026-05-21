import { describe, expect, it } from 'vitest';
import { careful, fast } from '../presets';
import { createRng } from '../rng';
import { planTypeKeystrokes } from './index';

const NO_RANDOMNESS = {
  baseDelayMs: 0,
  delayJitter: 0,
  typoProbability: 0,
  typoCorrectionProbability: 0,
  thinkPauseProbability: 0,
  thinkPauseMeanMs: 0,
};

describe('planTypeKeystrokes', () => {
  it('emits one keystroke per character with no typos / no delays', () => {
    const plan = planTypeKeystrokes('abc', NO_RANDOMNESS, createRng('t1'));
    expect(plan.map((k) => k.key)).toEqual(['a', 'b', 'c']);
    expect(plan.every((k) => !k.isTypo && !k.isCorrection)).toBe(true);
  });

  it('maps newline to Enter and tab to Tab', () => {
    const plan = planTypeKeystrokes('a\nb\tc', NO_RANDOMNESS, createRng('t2'));
    expect(plan.map((k) => k.key)).toEqual(['a', 'Enter', 'b', 'Tab', 'c']);
  });

  it('normalizes \\r and \\r\\n line endings to Enter', () => {
    const plan = planTypeKeystrokes('a\rb\r\nc', NO_RANDOMNESS, createRng('t3'));
    expect(plan.map((k) => k.key)).toEqual(['a', 'Enter', 'b', 'Enter', 'c']);
  });

  it('returns an empty plan for an empty string', () => {
    const plan = planTypeKeystrokes('', careful.typing, createRng('empty'));
    expect(plan).toEqual([]);
  });

  it('injects a typo + Backspace + correct when typoProbability and correction are 1', () => {
    const plan = planTypeKeystrokes(
      'a',
      { ...NO_RANDOMNESS, typoProbability: 1, typoCorrectionProbability: 1 },
      createRng('typo-1'),
    );
    expect(plan).toHaveLength(3);
    expect(plan[0]?.isTypo).toBe(true);
    expect(plan[0]?.key).not.toBe('a');
    expect(plan[1]?.key).toBe('Backspace');
    expect(plan[1]?.isCorrection).toBe(true);
    expect(plan[2]?.key).toBe('a');
    expect(plan[2]?.isCorrection).toBe(false);
  });

  it('leaves the typo in place when correction probability is 0', () => {
    const plan = planTypeKeystrokes(
      'a',
      { ...NO_RANDOMNESS, typoProbability: 1, typoCorrectionProbability: 0 },
      createRng('typo-2'),
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]?.isTypo).toBe(true);
    expect(plan[0]?.key).not.toBe('a');
  });

  it('preserves letter case in typo-adjacent keys (uppercase → uppercase)', () => {
    const plan = planTypeKeystrokes(
      'H',
      { ...NO_RANDOMNESS, typoProbability: 1, typoCorrectionProbability: 0 },
      createRng('case'),
    );
    expect(plan).toHaveLength(1);
    const wrong = plan[0]?.key ?? '';
    expect(wrong).toMatch(/^[A-Z]$/);
    expect(wrong).not.toBe('H');
  });

  it('produces an identical plan for the same seed and inputs (determinism)', () => {
    const a = planTypeKeystrokes('hello world', careful.typing, createRng('determinism-seed'));
    const b = planTypeKeystrokes('hello world', careful.typing, createRng('determinism-seed'));
    expect(a).toEqual(b);
  });

  it('produces a different plan for different seeds', () => {
    const a = planTypeKeystrokes('hello world', careful.typing, createRng('seed-a'));
    const b = planTypeKeystrokes('hello world', careful.typing, createRng('seed-b'));
    // The plans share key contents (the actual chars typed) but their delays
    // and any typo placements differ. Compare the serialized delay sequence.
    expect(a.map((k) => k.delayBeforeMs)).not.toEqual(b.map((k) => k.delayBeforeMs));
  });

  it('applies personalitySpeed and speedFactor multiplicatively', () => {
    const profile = { ...careful.typing, delayJitter: 0 };
    const base = planTypeKeystrokes('abc', profile, createRng('scale'));
    const fastPlan = planTypeKeystrokes('abc', profile, createRng('scale'), {
      personalitySpeed: 0.5,
    });
    const fasterPlan = planTypeKeystrokes('abc', profile, createRng('scale'), {
      personalitySpeed: 0.5,
      speedFactor: 0.5,
    });
    // After the first keystroke (which has no inter-key wait), each subsequent
    // delayBeforeMs scales linearly with the product personalitySpeed * speedFactor.
    expect(fastPlan[1]?.delayBeforeMs).toBeCloseTo((base[1]?.delayBeforeMs ?? 0) * 0.5);
    expect(fasterPlan[1]?.delayBeforeMs).toBeCloseTo((base[1]?.delayBeforeMs ?? 0) * 0.25);
  });

  it('produces a backspace step with longer perception in the bimodal-extension branch', () => {
    // With typoProbability=1 and typoCorrectionProbability=1 every step is a
    // typo+correction. Across many seeds we expect ~25% of corrections to land
    // in the extended-perception branch (~6× baseDelayMs instead of ~2×).
    // Check that the distribution actually spans both modes.
    const profile = { ...fast.typing, typoProbability: 1, typoCorrectionProbability: 1 };
    const perceptions: number[] = [];
    for (let i = 0; i < 80; i++) {
      const plan = planTypeKeystrokes('a', profile, createRng(`bimodal-${i}`));
      const backspace = plan.find((k) => k.isCorrection);
      if (backspace) perceptions.push(backspace.delayBeforeMs);
    }
    const baseline = fast.typing.baseDelayMs * 2;
    const shortRuns = perceptions.filter((d) => d < baseline * 2).length;
    const longRuns = perceptions.filter((d) => d > baseline * 2).length;
    // Both modes should appear in 80 samples — wide tolerance because RNG.
    expect(shortRuns).toBeGreaterThan(20);
    expect(longRuns).toBeGreaterThan(5);
  });
});
