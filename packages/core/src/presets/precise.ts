import type { Personality } from '../personality.js';

/**
 * Minimal noise, smooth motion, near-zero mistakes.
 * Closer to "expert user" than "average user".
 */
export const precise: Personality = {
  name: 'precise',
  speed: 1.0,
  mouse: {
    curvature: 0.2,
    travelTimeMs: 380,
    travelTimeJitter: 0.05,
    overshootProbability: 0.005,
    misclickProbability: 0.001,
  },
  typing: {
    baseDelayMs: 110,
    delayJitter: 0.1,
    typoProbability: 0.003,
    typoCorrectionProbability: 0.99,
    thinkPauseProbability: 0.03,
    thinkPauseMeanMs: 200,
  },
  reading: {
    wpm: 250,
    jitter: 0.08,
  },
  dwell: {
    preClickMs: 80,
    preClickJitter: 0.1,
    postActionMs: 60,
    postActionJitter: 0.1,
  },
};
