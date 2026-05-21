import { careful, distracted, fast, type PresetName, precise } from '@humanjs/core';

export interface PersonalityMeta {
  key: PresetName;
  tagline: string;
  description: string;
  /** Live `mouse.travelTimeMs` from the corresponding `@humanjs/core` preset. */
  travelMs: number;
  /** Live `mouse.curvature` from the corresponding `@humanjs/core` preset. */
  curvature: number;
  /** Live `mouse.travelTimeJitter` from `@humanjs/core` — a fraction in `[0, 1]`. */
  travelJitter: number;
}

export const personalityPresets: readonly PersonalityMeta[] = [
  {
    key: 'careful',
    tagline: 'Reads everything twice.',
    description: 'High dwell, medium curvature. Slow, deliberate trajectories.',
    travelMs: careful.mouse.travelTimeMs,
    curvature: careful.mouse.curvature,
    travelJitter: careful.mouse.travelTimeJitter,
  },
  {
    key: 'fast',
    tagline: 'Knows exactly where to go.',
    description: 'Brisk travel, low dwell. Confident, no second-guessing.',
    travelMs: fast.mouse.travelTimeMs,
    curvature: fast.mouse.curvature,
    travelJitter: fast.mouse.travelTimeJitter,
  },
  {
    key: 'distracted',
    tagline: 'Multitasking. Lots of sidebars.',
    description: 'Higher curvature and jitter, variable pauses between actions.',
    travelMs: distracted.mouse.travelTimeMs,
    curvature: distracted.mouse.curvature,
    travelJitter: distracted.mouse.travelTimeJitter,
  },
  {
    key: 'precise',
    tagline: 'Surgical.',
    description: 'Near-straight paths, minimal noise. Direct intent.',
    travelMs: precise.mouse.travelTimeMs,
    curvature: precise.mouse.curvature,
    travelJitter: precise.mouse.travelTimeJitter,
  },
];
