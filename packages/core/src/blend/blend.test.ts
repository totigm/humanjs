import { describe, expect, it } from 'vitest';
import { careful, distracted, fast, precise } from '../presets';
import { blend } from './index';

describe('blend', () => {
  describe('ratio bounds', () => {
    it('returns numerically equivalent to a at ratio 0', () => {
      const result = blend('careful', 'distracted', 0);
      expect(result.speed).toBe(careful.speed);
      expect(result.mouse.curvature).toBe(careful.mouse.curvature);
      expect(result.typing.baseDelayMs).toBe(careful.typing.baseDelayMs);
      expect(result.reading.wpm).toBe(careful.reading.wpm);
      expect(result.scroll.segmentsPerKpx).toBe(careful.scroll.segmentsPerKpx);
      expect(result.dwell.preClickMs).toBe(careful.dwell.preClickMs);
    });

    it('returns numerically equivalent to b at ratio 1', () => {
      const result = blend('careful', 'distracted', 1);
      expect(result.speed).toBe(distracted.speed);
      expect(result.mouse.curvature).toBe(distracted.mouse.curvature);
      expect(result.typing.baseDelayMs).toBe(distracted.typing.baseDelayMs);
      expect(result.reading.wpm).toBe(distracted.reading.wpm);
      expect(result.scroll.segmentsPerKpx).toBe(distracted.scroll.segmentsPerKpx);
      expect(result.dwell.preClickMs).toBe(distracted.dwell.preClickMs);
    });

    it('lands at the midpoint at ratio 0.5', () => {
      const result = blend('careful', 'distracted', 0.5);
      expect(result.speed).toBeCloseTo((careful.speed + distracted.speed) / 2, 10);
      expect(result.mouse.curvature).toBeCloseTo(
        (careful.mouse.curvature + distracted.mouse.curvature) / 2,
        10,
      );
      expect(result.typing.typoProbability).toBeCloseTo(
        (careful.typing.typoProbability + distracted.typing.typoProbability) / 2,
        10,
      );
    });

    it('clamps ratios below 0 to 0', () => {
      const result = blend('careful', 'distracted', -1);
      expect(result.speed).toBe(careful.speed);
      expect(result.mouse.curvature).toBe(careful.mouse.curvature);
    });

    it('clamps ratios above 1 to 1', () => {
      const result = blend('careful', 'distracted', 2);
      expect(result.speed).toBe(distracted.speed);
      expect(result.mouse.curvature).toBe(distracted.mouse.curvature);
    });
  });

  describe('interpolation', () => {
    it('lerps each numeric field independently', () => {
      const t = 0.3;
      const result = blend('careful', 'distracted', t);
      const expected = (a: number, b: number) => a + (b - a) * t;

      expect(result.speed).toBeCloseTo(expected(careful.speed, distracted.speed), 10);
      expect(result.mouse.travelTimeMs).toBeCloseTo(
        expected(careful.mouse.travelTimeMs, distracted.mouse.travelTimeMs),
        10,
      );
      // clickSpread joined the lerp list with the personality-driven click
      // placement change — guards against the field silently dropping out
      // of blend's lerp object (TypeScript would catch a missing field but
      // not an accidental `personalityA.mouse.clickSpread` typo).
      expect(result.mouse.clickSpread).toBeCloseTo(
        expected(careful.mouse.clickSpread, distracted.mouse.clickSpread),
        10,
      );
      expect(result.typing.thinkPauseMeanMs).toBeCloseTo(
        expected(careful.typing.thinkPauseMeanMs, distracted.typing.thinkPauseMeanMs),
        10,
      );
      expect(result.scroll.pauseMs).toBeCloseTo(
        expected(careful.scroll.pauseMs, distracted.scroll.pauseMs),
        10,
      );
    });

    it('keeps probabilities in [0, 1] when both inputs are', () => {
      const result = blend('careful', 'distracted', 0.7);
      const probabilities = [
        result.mouse.overshootProbability,
        result.mouse.misclickProbability,
        result.typing.typoProbability,
        result.typing.typoCorrectionProbability,
        result.typing.thinkPauseProbability,
        result.scroll.pauseProbability,
        result.scroll.overshootProbability,
      ];
      for (const p of probabilities) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('naming', () => {
    it('encodes both source names and the ratio', () => {
      const result = blend('careful', 'distracted', 0.3);
      expect(result.name).toBe('careful+distracted@0.30');
    });

    it('uses formatted ratio with two decimals', () => {
      expect(blend('fast', 'precise', 0).name).toBe('fast+precise@0.00');
      expect(blend('fast', 'precise', 1).name).toBe('fast+precise@1.00');
      expect(blend('fast', 'precise', 0.333).name).toBe('fast+precise@0.33');
    });
  });

  describe('input shapes', () => {
    it('accepts preset names', () => {
      const result = blend('fast', 'precise', 0.5);
      expect(result.reading.wpm).toBeCloseTo((fast.reading.wpm + precise.reading.wpm) / 2, 10);
    });

    it('accepts full Personality objects', () => {
      const result = blend(careful, distracted, 0.5);
      expect(result.speed).toBeCloseTo((careful.speed + distracted.speed) / 2, 10);
    });

    it('accepts preset extensions', () => {
      const result = blend(
        { extends: 'careful', typing: { typoProbability: 0 } },
        'distracted',
        0.5,
      );
      const expectedTypoProb = (0 + distracted.typing.typoProbability) / 2;
      expect(result.typing.typoProbability).toBeCloseTo(expectedTypoProb, 10);
    });

    it('blends with blends (composable)', () => {
      const a = blend('careful', 'fast', 0.5);
      const b = blend('distracted', 'precise', 0.5);
      const c = blend(a, b, 0.5);
      expect(c.name).toContain('@0.50');
      expect(c.speed).toBeGreaterThan(0);
    });
  });

  describe('immutability', () => {
    it('does not mutate either input preset', () => {
      const carefulBefore = careful.typing.typoProbability;
      const distractedBefore = distracted.typing.typoProbability;
      blend('careful', 'distracted', 0.7);
      expect(careful.typing.typoProbability).toBe(carefulBefore);
      expect(distracted.typing.typoProbability).toBe(distractedBefore);
    });
  });
});
