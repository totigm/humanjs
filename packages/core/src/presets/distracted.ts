import type { Personality } from '../personality.js';

/**
 * Scrolls back, retypes, hovers off, occasional misclicks.
 * Useful for stress-testing flows that assume perfect input.
 */
export const distracted: Personality = {
  name: 'distracted',
  speed: 1.3,
  mouse: {
    curvature: 0.6,
    travelTimeMs: 600,
    travelTimeJitter: 0.35,
    overshootProbability: 0.15,
    misclickProbability: 0.05,
  },
  typing: {
    baseDelayMs: 180,
    delayJitter: 0.5,
    typoProbability: 0.06,
    typoCorrectionProbability: 0.7,
    thinkPauseProbability: 0.18,
    thinkPauseMeanMs: 700,
  },
  reading: {
    wpm: 180,
    jitter: 0.4,
  },
  dwell: {
    preClickMs: 200,
    preClickJitter: 0.5,
    postActionMs: 250,
    postActionJitter: 0.5,
  },
};
