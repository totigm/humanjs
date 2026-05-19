import { describe, expect, it } from 'vitest';
import { createRng } from './index';

describe('createRng', () => {
  describe('determinism', () => {
    it('produces identical sequences for identical string seeds', () => {
      const a = createRng('test-seed');
      const b = createRng('test-seed');
      const seqA = Array.from({ length: 20 }, () => a.next());
      const seqB = Array.from({ length: 20 }, () => b.next());
      expect(seqA).toEqual(seqB);
    });

    it('produces different sequences for different seeds', () => {
      const a = createRng('seed-a');
      const b = createRng('seed-b');
      const seqA = Array.from({ length: 20 }, () => a.next());
      const seqB = Array.from({ length: 20 }, () => b.next());
      expect(seqA).not.toEqual(seqB);
    });

    it('accepts numeric seeds', () => {
      const a = createRng(42);
      const b = createRng(42);
      expect(a.next()).toBe(b.next());
    });

    it('treats string and equivalent numeric seeds as different', () => {
      const fromString = createRng('42');
      const fromNumber = createRng(42);
      expect(fromString.next()).not.toBe(fromNumber.next());
    });

    it('produces different sequences across two undefined-seed instances', () => {
      // System-time-based seeds — values will almost certainly differ.
      const a = createRng();
      const b = createRng();
      expect(a.next()).not.toBe(b.next());
    });
  });

  describe('next()', () => {
    it('returns floats in [0, 1) over many samples', () => {
      const rng = createRng('range');
      for (let i = 0; i < 1000; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('nextInt(min, max)', () => {
    it('returns integers in [min, max)', () => {
      const rng = createRng('int');
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextInt(5, 10);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThan(10);
      }
    });
  });

  describe('nextFloat(min, max)', () => {
    it('returns floats in [min, max)', () => {
      const rng = createRng('float');
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextFloat(-2.5, 7.5);
        expect(v).toBeGreaterThanOrEqual(-2.5);
        expect(v).toBeLessThan(7.5);
      }
    });
  });

  describe('chance(p)', () => {
    it('returns true ~p fraction of the time over many samples', () => {
      const rng = createRng('chance');
      const samples = 10000;
      let trueCount = 0;
      for (let i = 0; i < samples; i++) {
        if (rng.chance(0.3)) trueCount++;
      }
      const ratio = trueCount / samples;
      expect(ratio).toBeGreaterThan(0.27);
      expect(ratio).toBeLessThan(0.33);
    });

    it('always returns false for p <= 0', () => {
      const rng = createRng('p-zero');
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(-1)).toBe(false);
        expect(rng.chance(0)).toBe(false);
      }
    });

    it('always returns true for p >= 1', () => {
      const rng = createRng('p-one');
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(1)).toBe(true);
        expect(rng.chance(2)).toBe(true);
      }
    });
  });

  describe('nextGaussian()', () => {
    it('has approximately mean=0, stdDev=1 by default', () => {
      const rng = createRng('gaussian');
      const samples = 10000;
      const values: number[] = [];
      let sum = 0;
      for (let i = 0; i < samples; i++) {
        const v = rng.nextGaussian();
        values.push(v);
        sum += v;
      }
      const mean = sum / samples;
      const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples;
      const stdDev = Math.sqrt(variance);
      expect(Math.abs(mean)).toBeLessThan(0.05);
      expect(Math.abs(stdDev - 1)).toBeLessThan(0.05);
    });

    it('shifts and scales by mean and stdDev parameters', () => {
      const rng = createRng('gaussian-scaled');
      const samples = 10000;
      let sum = 0;
      for (let i = 0; i < samples; i++) {
        sum += rng.nextGaussian(100, 10);
      }
      const mean = sum / samples;
      expect(Math.abs(mean - 100)).toBeLessThan(0.5);
    });
  });
});
