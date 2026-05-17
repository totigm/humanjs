import type { Personality } from './personality.js';
import { type PersonalityConfig, resolvePersonality } from './resolve.js';

/**
 * Composes two personalities into a new one by linearly interpolating
 * every numeric field at the given ratio.
 *
 * Both inputs are first resolved (so preset names, extensions, and full
 * personalities are all accepted). Then every numeric field — top-level
 * `speed` plus every field on every facet — is interpolated as
 * `a + (b - a) * ratio`. The base presets are never mutated.
 *
 * @param a - First personality. The result equals `a` at `ratio = 0`.
 * @param b - Second personality. The result equals `b` at `ratio = 1`.
 * @param ratio - How much of `b` to mix in, from 0 to 1.
 *   `0` returns pure `a`, `1` returns pure `b`, `0.5` is the midpoint.
 *   Clamped if out of range.
 *
 * @example Two-way blend
 * ```ts
 * // 70% careful + 30% distracted
 * const mostlyCareful = blend('careful', 'distracted', 0.3);
 * ```
 *
 * @example Three-way blend via composition
 * ```ts
 * // Equal mix of three: (2/3) × (0.5·careful + 0.5·fast) + (1/3) × distracted
 * const even = blend(blend('careful', 'fast', 0.5), 'distracted', 1 / 3);
 * ```
 */
export function blend(a: PersonalityConfig, b: PersonalityConfig, ratio: number): Personality {
  const personalityA = resolvePersonality(a);
  const personalityB = resolvePersonality(b);
  const t = clamp(ratio, 0, 1);

  return {
    name: `${personalityA.name}+${personalityB.name}@${t.toFixed(2)}`,
    speed: lerp(personalityA.speed, personalityB.speed, t),
    mouse: {
      curvature: lerp(personalityA.mouse.curvature, personalityB.mouse.curvature, t),
      travelTimeMs: lerp(personalityA.mouse.travelTimeMs, personalityB.mouse.travelTimeMs, t),
      travelTimeJitter: lerp(
        personalityA.mouse.travelTimeJitter,
        personalityB.mouse.travelTimeJitter,
        t,
      ),
      overshootProbability: lerp(
        personalityA.mouse.overshootProbability,
        personalityB.mouse.overshootProbability,
        t,
      ),
      misclickProbability: lerp(
        personalityA.mouse.misclickProbability,
        personalityB.mouse.misclickProbability,
        t,
      ),
    },
    typing: {
      baseDelayMs: lerp(personalityA.typing.baseDelayMs, personalityB.typing.baseDelayMs, t),
      delayJitter: lerp(personalityA.typing.delayJitter, personalityB.typing.delayJitter, t),
      typoProbability: lerp(
        personalityA.typing.typoProbability,
        personalityB.typing.typoProbability,
        t,
      ),
      typoCorrectionProbability: lerp(
        personalityA.typing.typoCorrectionProbability,
        personalityB.typing.typoCorrectionProbability,
        t,
      ),
      thinkPauseProbability: lerp(
        personalityA.typing.thinkPauseProbability,
        personalityB.typing.thinkPauseProbability,
        t,
      ),
      thinkPauseMeanMs: lerp(
        personalityA.typing.thinkPauseMeanMs,
        personalityB.typing.thinkPauseMeanMs,
        t,
      ),
    },
    reading: {
      wpm: lerp(personalityA.reading.wpm, personalityB.reading.wpm, t),
      jitter: lerp(personalityA.reading.jitter, personalityB.reading.jitter, t),
    },
    dwell: {
      preClickMs: lerp(personalityA.dwell.preClickMs, personalityB.dwell.preClickMs, t),
      preClickJitter: lerp(personalityA.dwell.preClickJitter, personalityB.dwell.preClickJitter, t),
      postActionMs: lerp(personalityA.dwell.postActionMs, personalityB.dwell.postActionMs, t),
      postActionJitter: lerp(
        personalityA.dwell.postActionJitter,
        personalityB.dwell.postActionJitter,
        t,
      ),
    },
  };
}

/**
 * Linear interpolation between two numbers. Returns `a` at `t = 0`,
 * `b` at `t = 1`, and a proportional mix in between.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamps `value` to the inclusive range `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
