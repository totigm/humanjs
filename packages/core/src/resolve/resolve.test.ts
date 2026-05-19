import { describe, expect, it } from 'vitest';
import type { Personality } from '../personality';
import { careful, distracted, fast, precise } from '../presets';
import { resolvePersonality } from './index';

describe('resolvePersonality', () => {
  describe('preset name', () => {
    it('looks up each built-in preset by name', () => {
      expect(resolvePersonality('careful')).toBe(careful);
      expect(resolvePersonality('fast')).toBe(fast);
      expect(resolvePersonality('distracted')).toBe(distracted);
      expect(resolvePersonality('precise')).toBe(precise);
    });
  });

  describe('full Personality', () => {
    it('returns a fully built Personality unchanged', () => {
      const custom: Personality = { ...careful, name: 'my-custom' };
      expect(resolvePersonality(custom)).toBe(custom);
    });
  });

  describe('preset + overrides', () => {
    it('keeps the base name when none is given', () => {
      const result = resolvePersonality({ extends: 'careful' });
      expect(result.name).toBe('careful');
    });

    it('uses the override name when given', () => {
      const result = resolvePersonality({
        extends: 'careful',
        name: 'careful-renamed',
      });
      expect(result.name).toBe('careful-renamed');
    });

    it('overrides top-level speed', () => {
      const result = resolvePersonality({ extends: 'careful', speed: 0.25 });
      expect(result.speed).toBe(0.25);
    });

    it('merges a partial facet without losing the rest', () => {
      const result = resolvePersonality({
        extends: 'careful',
        typing: { typoProbability: 0.1 },
      });
      expect(result.typing.typoProbability).toBe(0.1);
      expect(result.typing.baseDelayMs).toBe(careful.typing.baseDelayMs);
      expect(result.typing.thinkPauseMeanMs).toBe(careful.typing.thinkPauseMeanMs);
    });

    it('preserves unrelated facets untouched', () => {
      const result = resolvePersonality({
        extends: 'careful',
        mouse: { curvature: 0.9 },
      });
      expect(result.typing).toEqual(careful.typing);
      expect(result.reading).toEqual(careful.reading);
      expect(result.dwell).toEqual(careful.dwell);
    });

    it('merges multiple facets simultaneously', () => {
      const result = resolvePersonality({
        extends: 'precise',
        mouse: { curvature: 0.9 },
        typing: { typoProbability: 0.5 },
        reading: { wpm: 100 },
      });
      expect(result.mouse.curvature).toBe(0.9);
      expect(result.typing.typoProbability).toBe(0.5);
      expect(result.reading.wpm).toBe(100);
      expect(result.dwell).toEqual(precise.dwell);
    });

    it('does not mutate the base preset', () => {
      const before = careful.typing.typoProbability;
      resolvePersonality({
        extends: 'careful',
        typing: { typoProbability: 0.99 },
      });
      expect(careful.typing.typoProbability).toBe(before);
    });

    it('produces a fresh object every call', () => {
      const a = resolvePersonality({ extends: 'careful' });
      const b = resolvePersonality({ extends: 'careful' });
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });
});
