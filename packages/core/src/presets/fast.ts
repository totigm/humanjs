import type { Personality } from '../personality.js';

/**
 * Quick but still natural. Fewer pauses, lower typo rate, shorter dwell.
 * Good for sessions where the user "knows the app".
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
  },
  typing: {
    baseDelayMs: 60,
    delayJitter: 0.25,
    typoProbability: 0.015,
    typoCorrectionProbability: 0.9,
    thinkPauseProbability: 0.02,
    thinkPauseMeanMs: 150,
  },
  reading: {
    wpm: 350,
    jitter: 0.15,
  },
  dwell: {
    preClickMs: 50,
    preClickJitter: 0.25,
    postActionMs: 40,
    postActionJitter: 0.25,
  },
};
