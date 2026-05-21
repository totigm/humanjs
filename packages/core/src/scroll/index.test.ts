import { describe, expect, it } from 'vitest';
import { careful, distracted } from '../presets';
import { createRng } from '../rng';
import { planScroll } from './index';

const NO_NOISE = {
  segmentsPerKpx: 20,
  segmentDelayMs: 10,
  segmentDelayJitter: 0,
  pauseProbability: 0,
  pauseMs: 100,
  pauseMsJitter: 0,
  overshootProbability: 0,
  overshootRatio: 0,
};

describe('planScroll', () => {
  it('returns an empty plan when distance is 0', () => {
    expect(planScroll(100, 100, NO_NOISE, createRng('a'))).toEqual([]);
  });

  it('sums to the requested distance for downward scrolls', () => {
    const plan = planScroll(0, 1000, NO_NOISE, createRng('d1'));
    const totalDelta = plan.reduce((sum, s) => sum + s.deltaY, 0);
    expect(totalDelta).toBeCloseTo(1000, 6);
  });

  it('sums to the requested distance for upward scrolls', () => {
    const plan = planScroll(1000, 0, NO_NOISE, createRng('u1'));
    const totalDelta = plan.reduce((sum, s) => sum + s.deltaY, 0);
    expect(totalDelta).toBeCloseTo(-1000, 6);
    // Every non-pause segment should move up (negative).
    for (const s of plan) {
      if (s.deltaY !== 0) expect(s.deltaY).toBeLessThan(0);
    }
  });

  it('produces a non-empty plan even for tiny distances (minimum 2 segments)', () => {
    const plan = planScroll(0, 5, NO_NOISE, createRng('tiny'));
    expect(plan.length).toBeGreaterThanOrEqual(2);
  });

  it('scales segment count with distance', () => {
    const short = planScroll(0, 500, NO_NOISE, createRng('s'));
    const long = planScroll(0, 5000, NO_NOISE, createRng('l'));
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('is deterministic given the same seed and inputs', () => {
    const a = planScroll(0, 1500, careful.scroll, createRng('det'), { personalitySpeed: 1 });
    const b = planScroll(0, 1500, careful.scroll, createRng('det'), { personalitySpeed: 1 });
    expect(a).toEqual(b);
  });

  it('produces different plans for different seeds (jitter / pauses / overshoot consume RNG)', () => {
    const a = planScroll(0, 2000, careful.scroll, createRng('a'));
    const b = planScroll(0, 2000, careful.scroll, createRng('b'));
    expect(a).not.toEqual(b);
  });

  it('inserts mid-scroll pauses when pauseProbability > 0', () => {
    // `distracted` has pauseProbability 0.3 — over a long enough scroll we
    // should land at least one pause segment (deltaY === 0).
    const plan = planScroll(0, 4000, distracted.scroll, createRng('pause-seed'));
    const pauseCount = plan.filter((s) => s.deltaY === 0).length;
    expect(pauseCount).toBeGreaterThan(0);
  });

  it('omits pauses entirely when withPauses is false', () => {
    const plan = planScroll(0, 4000, distracted.scroll, createRng('np'), { withPauses: false });
    // No-overshoot path (no realize-pause), no mid-scroll pauses → no zero segments.
    expect(plan.every((s) => s.deltaY !== 0 || s === plan[plan.length - 1])).toBe(true);
  });

  it('produces a bell-curve velocity profile (mid segment delta > end segment delta)', () => {
    // With pauses/overshoot off, deltas should follow a half-sine: small at
    // the edges, biggest in the middle.
    const plan = planScroll(0, 2000, NO_NOISE, createRng('bell'));
    const moves = plan.filter((s) => s.deltaY !== 0);
    expect(moves.length).toBeGreaterThan(4);
    const first = moves[0];
    const mid = moves[Math.floor(moves.length / 2)];
    const last = moves[moves.length - 1];
    expect(first).toBeDefined();
    expect(mid).toBeDefined();
    expect(last).toBeDefined();
    if (first && mid && last) {
      expect(Math.abs(mid.deltaY)).toBeGreaterThan(Math.abs(first.deltaY));
      expect(Math.abs(mid.deltaY)).toBeGreaterThan(Math.abs(last.deltaY));
    }
  });

  it('respects forceOvershoot — plan goes past target then corrects back', () => {
    // distance 1000, overshootRatio 0.1 (we pick a profile with overshoot
    // enabled). The peak Y reached during the plan should exceed the target.
    const plan = planScroll(
      0,
      1000,
      { ...NO_NOISE, overshootRatio: 0.15 },
      createRng('overshoot'),
      { forceOvershoot: true },
    );
    // Walk the plan and track running Y.
    let y = 0;
    let peakY = 0;
    for (const s of plan) {
      y += s.deltaY;
      if (y > peakY) peakY = y;
    }
    expect(peakY).toBeGreaterThan(1000); // overshot
    expect(y).toBeCloseTo(1000, 6); // corrected back to target
  });

  it('skips overshoot in instant mode (speedFactor: 0) even when forced', () => {
    const plan = planScroll(0, 1000, NO_NOISE, createRng('inst'), {
      forceOvershoot: true,
      speedFactor: 0,
    });
    // Walk Y — should never exceed target (no overshoot).
    let y = 0;
    let peakY = 0;
    for (const s of plan) {
      y += s.deltaY;
      if (y > peakY) peakY = y;
    }
    expect(peakY).toBeLessThanOrEqual(1000 + 1); // float epsilon
  });

  it('zeros every delayBeforeMs when speedFactor is 0', () => {
    const plan = planScroll(0, 1000, careful.scroll, createRng('inst-delay'), { speedFactor: 0 });
    for (const s of plan) {
      expect(s.delayBeforeMs).toBe(0);
    }
  });

  it('scales every delay by personalitySpeed × speedFactor multiplicatively', () => {
    const baseProfile = { ...NO_NOISE, segmentDelayMs: 10 };
    const base = planScroll(0, 1000, baseProfile, createRng('scale'), { personalitySpeed: 1 });
    const half = planScroll(0, 1000, baseProfile, createRng('scale'), { personalitySpeed: 0.5 });
    expect(base.length).toBe(half.length);
    for (let i = 0; i < base.length; i++) {
      const b = base[i]?.delayBeforeMs ?? 0;
      const h = half[i]?.delayBeforeMs ?? 0;
      expect(h).toBeCloseTo(b * 0.5, 6);
    }
  });
});
