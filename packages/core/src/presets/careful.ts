import type { Personality } from '../personality';

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
    // 0.125 (≈ 1/8) is the previous global default — careful users aim
    // deliberately. Two-thirds of clicks land within the central quarter
    // of the element.
    clickSpread: 0.125,
  },
  typing: {
    baseDelayMs: 140,
    delayJitter: 0.3,
    typoProbability: 0.02,
    typoCorrectionProbability: 1.0,
    thinkPauseProbability: 0.08,
    thinkPauseMeanMs: 400,
  },
  reading: {
    wpm: 220,
    jitter: 0.2,
  },
  scroll: {
    // ~55 events per 1000 px at ~14 ms apart matches a real mouse-wheel
    // cadence (50–60 Hz). Per-event delta lands around 18 px — close to a
    // real wheel "line" — so the browser smooth-paints between events.
    segmentsPerKpx: 55,
    segmentDelayMs: 14,
    segmentDelayJitter: 0.3,
    pauseProbability: 0.1,
    pauseMs: 200,
    pauseMsJitter: 0.4,
    overshootProbability: 0.05,
    overshootRatio: 0.16,
  },
  dwell: {
    preClickMs: 120,
    preClickJitter: 0.3,
    postActionMs: 90,
    postActionJitter: 0.3,
  },
};
