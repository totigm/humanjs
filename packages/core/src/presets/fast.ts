import type { Personality } from '../personality';

/**
 * Quick but still natural. Fewer pauses, lower typo rate, shorter dwell.
 * Good for sessions where the user "knows the app".
 *
 * Typing pace: `baseDelayMs × speed` = 130 × 0.5 = 65 ms/char ≈ 185 wpm.
 * That's a real top-tier touch typist — fast enough to feel brisk, slow
 * enough to stay inside the human envelope. The library is called HumanJS;
 * none of the presets should type faster than a real human can.
 */
export const fast: Personality = {
  name: 'fast',
  speed: 0.5,
  mouse: {
    curvature: 0.25,
    travelTimeMs: 250,
    travelTimeJitter: 0.1,
    overshootProbability: 0.03,
    misclickProbability: 0.005,
    // 0.15 — Fitts's Law: speed trades against precision. Faster users
    // aim less carefully and scatter more across the target, but stay
    // visibly inside the safe interior — no edge near-misses.
    clickSpread: 0.15,
  },
  typing: {
    baseDelayMs: 130,
    delayJitter: 0.25,
    typoProbability: 0.015,
    typoCorrectionProbability: 1.0,
    thinkPauseProbability: 0.02,
    thinkPauseMeanMs: 150,
  },
  reading: {
    wpm: 350,
    jitter: 0.15,
  },
  scroll: {
    segmentsPerKpx: 40,
    segmentDelayMs: 8,
    segmentDelayJitter: 0.2,
    pauseProbability: 0.025,
    pauseMs: 100,
    pauseMsJitter: 0.3,
    overshootProbability: 0.02,
    overshootRatio: 0.1,
  },
  dwell: {
    preClickMs: 50,
    preClickJitter: 0.25,
    postActionMs: 40,
    postActionJitter: 0.25,
  },
};
