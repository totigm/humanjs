import { describe, expect, it } from 'vitest';
import type { Personality } from '../personality';
import { careful, distracted, fast, precise } from './index';

const presets: Record<string, Personality> = { careful, fast, distracted, precise };

describe('built-in presets', () => {
  for (const [presetName, preset] of Object.entries(presets)) {
    describe(presetName, () => {
      it('reports its own name', () => {
        expect(preset.name).toBe(presetName);
      });

      it('declares all five facets', () => {
        expect(preset).toHaveProperty('speed');
        expect(preset).toHaveProperty('mouse');
        expect(preset).toHaveProperty('typing');
        expect(preset).toHaveProperty('reading');
        expect(preset).toHaveProperty('dwell');
      });

      it('keeps every probability in [0, 1]', () => {
        const probabilities = [
          preset.mouse.overshootProbability,
          preset.mouse.misclickProbability,
          preset.typing.typoProbability,
          preset.typing.typoCorrectionProbability,
          preset.typing.thinkPauseProbability,
        ];
        for (const p of probabilities) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
      });

      it('keeps every jitter in [0, 1]', () => {
        const jitters = [
          preset.mouse.travelTimeJitter,
          preset.typing.delayJitter,
          preset.reading.jitter,
          preset.dwell.preClickJitter,
          preset.dwell.postActionJitter,
        ];
        for (const j of jitters) {
          expect(j).toBeGreaterThanOrEqual(0);
          expect(j).toBeLessThanOrEqual(1);
        }
      });

      it('reads at a plausible human WPM', () => {
        expect(preset.reading.wpm).toBeGreaterThan(50);
        expect(preset.reading.wpm).toBeLessThan(500);
      });

      it('types at a plausible human WPM', () => {
        // Effective per-character delay = baseDelayMs × speed.
        // Convert to WPM via the canonical 5-chars-per-word convention.
        const msPerChar = preset.typing.baseDelayMs * preset.speed;
        const wpm = 60_000 / (msPerChar * 5);
        // World-record typing tops out around 216 wpm. We clamp comfortably
        // below the record so even our "fast" personality stays clearly human.
        // Floor allows for distracted/half-attentive typing.
        expect(wpm).toBeGreaterThan(20);
        expect(wpm).toBeLessThan(200);
      });

      it('uses positive timing values', () => {
        expect(preset.mouse.travelTimeMs).toBeGreaterThan(0);
        expect(preset.typing.baseDelayMs).toBeGreaterThan(0);
        expect(preset.typing.thinkPauseMeanMs).toBeGreaterThan(0);
        expect(preset.dwell.preClickMs).toBeGreaterThan(0);
        expect(preset.dwell.postActionMs).toBeGreaterThan(0);
        expect(preset.speed).toBeGreaterThan(0);
      });
    });
  }

  it('exposes four distinct presets', () => {
    const names = Object.values(presets).map((p) => p.name);
    expect(new Set(names).size).toBe(4);
  });
});
