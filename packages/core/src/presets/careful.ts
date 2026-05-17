import type { Personality } from '../personality.js';

/**
 * Slow, precise, few mistakes. Longer dwell on important fields.
 * The default personality when none is specified.
 */
export const careful: Personality = {
  name: 'careful',
  speed: 1.0,
  mouse: {
    curvature: 0.4,
    travelTimeMs: 450,
    travelTimeJitter: 0.15,
    overshootProbability: 0.05,
    misclickProbability: 0.01,
  },
  typing: {
    baseDelayMs: 140,
    delayJitter: 0.3,
    typoProbability: 0.02,
    typoCorrectionProbability: 0.95,
    thinkPauseProbability: 0.08,
    thinkPauseMeanMs: 400,
  },
  reading: {
    wpm: 220,
    jitter: 0.2,
  },
  dwell: {
    preClickMs: 120,
    preClickJitter: 0.3,
    postActionMs: 90,
    postActionJitter: 0.3,
  },
};
