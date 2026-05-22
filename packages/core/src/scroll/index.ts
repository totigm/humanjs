import type { ScrollProfile } from '../personality';
import type { Rng } from '../rng';

/** One step in a humanized scroll plan. */
export interface ScrollSegment {
  /**
   * Signed pixel delta along the scroll axis (positive = forward / down /
   * right, negative = backward / up / left). The planner is axis-agnostic —
   * the executor decides whether to apply this to Y or X.
   *
   * A segment with `delta === 0` is a pure pause: the adapter still waits
   * `delayBeforeMs`, but no wheel event fires.
   */
  readonly delta: number;
  /** Pause in ms before dispatching this segment. */
  readonly delayBeforeMs: number;
}

/** Options for {@link planScroll}. */
export interface PlanScrollOptions {
  /**
   * Override `profile.overshootProbability` for this plan only. Useful when
   * the adapter has stronger signal than the personality (e.g. "scroll to
   * this element with intentional overshoot").
   */
  readonly forceOvershoot?: boolean;
  /**
   * Disable mid-scroll pauses. Useful for short scrolls where a pause feels
   * wrong, or when the caller wants the smoothest possible motion.
   */
  readonly withPauses?: boolean;
  /**
   * Personality-tempo multiplier (`personality.speed`). Defaults to 1.
   * Applied to every segment's delay.
   */
  readonly personalitySpeed?: number;
  /**
   * Speed-mode factor (`1` human, `0.5` fast, `0` instant). Defaults to 1.
   * `0` collapses every delay to zero and skips overshoot.
   */
  readonly speedFactor?: number;
}

/**
 * Plans a humanized vertical scroll from `fromY` to `toY` as a sequence of
 * wheel-event-shaped segments. Pure function, deterministic given the same
 * RNG state and inputs.
 *
 * Motion model:
 *   1. Segment count scales with distance via `profile.segmentsPerKpx`.
 *   2. Per-segment delta follows a bell-curve velocity profile (slow start,
 *      fast middle, slow end) — robotic scroll is one big jump; humans
 *      accelerate, peak, and decelerate.
 *   3. Mid-scroll pauses sprinkled with probability `profile.pauseProbability`
 *      between segments (skip the first and last so we never pause *at* the
 *      ends, which would look wrong).
 *   4. Optional overshoot: with `profile.overshootProbability` (or forced by
 *      `options.forceOvershoot`), plan continues past `toY` by
 *      `distance × profile.overshootRatio`, dwells briefly, then reverses
 *      back to `toY`. Real eyes / scroll wheels do this when target is
 *      below the fold and you misjudge distance.
 *
 * The sum of segment `delta`s always equals `toY - fromY` (within
 * floating-point rounding).
 */
export function planScroll(
  fromY: number,
  toY: number,
  profile: ScrollProfile,
  rng: Rng,
  options: PlanScrollOptions = {},
): readonly ScrollSegment[] {
  const personalitySpeed = options.personalitySpeed ?? 1;
  const speedFactor = options.speedFactor ?? 1;
  const withPauses = options.withPauses ?? true;

  const distance = toY - fromY;
  if (distance === 0) return [];

  const direction = distance >= 0 ? 1 : -1;
  const absDistance = Math.abs(distance);

  // Decide whether to overshoot. Skipped in instant mode (speedFactor 0)
  // because overshoot is purely a visual humanization signal — without
  // delay there's no way to perceive it.
  const wantsOvershoot = options.forceOvershoot ?? rng.next() < profile.overshootProbability;
  const overshoot =
    wantsOvershoot && speedFactor > 0
      ? Math.max(0, Math.min(0.5, profile.overshootRatio)) * absDistance
      : 0;

  const segments: ScrollSegment[] = [];

  // Phase 1: from → (target + overshoot * direction)
  const phase1End = toY + overshoot * direction;
  appendBellPhase(
    segments,
    fromY,
    phase1End,
    profile,
    rng,
    personalitySpeed,
    speedFactor,
    withPauses,
  );

  // Phase 2: pause at the overshot position + correct back to target.
  if (overshoot > 0) {
    // "Wait, I went too far" pause. Long enough to read as deliberate
    // recognition — short pauses get lost in the bell-curve decel and the
    // whole overshoot just looks like the scroll stalled.
    const realizeMs = jitter(profile.pauseMs * 2.5, profile.pauseMsJitter, rng);
    segments.push({
      delta: 0,
      delayBeforeMs: realizeMs * personalitySpeed * speedFactor,
    });
    appendBellPhase(
      segments,
      phase1End,
      toY,
      profile,
      rng,
      personalitySpeed,
      speedFactor,
      /* withPauses */ false, // correction is one fluid motion
    );
  }

  return segments;
}

/**
 * Appends bell-curve-velocity segments from `startY` to `endY`. Each
 * segment's `delta` is proportional to its position on a half-sine curve
 * so motion accelerates from `startY`, peaks at the midpoint, and decays
 * into `endY`. The sum of appended `delta`s equals `endY - startY` exactly.
 */
function appendBellPhase(
  out: ScrollSegment[],
  startY: number,
  endY: number,
  profile: ScrollProfile,
  rng: Rng,
  personalitySpeed: number,
  speedFactor: number,
  withPauses: boolean,
): void {
  const distance = endY - startY;
  if (distance === 0) return;

  const absDistance = Math.abs(distance);
  const direction = distance >= 0 ? 1 : -1;
  const segments = Math.max(2, Math.ceil((absDistance / 1000) * profile.segmentsPerKpx));

  // Bell weights: sin(i / segments × π) for i = 0..segments-1. Skipping i=0
  // gives a non-zero first step so the cursor doesn't sit motionless on the
  // first frame.
  const weights: number[] = [];
  let totalWeight = 0;
  for (let i = 0; i < segments; i++) {
    const w = Math.sin(((i + 0.5) / segments) * Math.PI);
    weights.push(w);
    totalWeight += w;
  }

  for (let i = 0; i < segments; i++) {
    const w = weights[i] ?? 0;
    const delta = (w / totalWeight) * absDistance * direction;
    const baseDelay = jitter(profile.segmentDelayMs, profile.segmentDelayJitter, rng);
    out.push({
      delta,
      delayBeforeMs: baseDelay * personalitySpeed * speedFactor,
    });
    // Maybe insert a pause AFTER this segment (not at the very end).
    if (
      withPauses &&
      i < segments - 1 &&
      rng.next() < profile.pauseProbability &&
      speedFactor > 0
    ) {
      const pauseMs = jitter(profile.pauseMs, profile.pauseMsJitter, rng);
      out.push({
        delta: 0,
        delayBeforeMs: pauseMs * personalitySpeed * speedFactor,
      });
    }
  }
}

/** Symmetric jitter: `base × [1 - jitter, 1 + jitter]`. Clamped to ≥ 0. */
function jitter(base: number, jitterRatio: number, rng: Rng): number {
  if (jitterRatio <= 0) return Math.max(0, base);
  const offset = rng.nextFloat(-jitterRatio, jitterRatio);
  return Math.max(0, base * (1 + offset));
}
