export const VERSION = '0.0.0';

export type { BezierPathOptions, Point } from './bezier';
export { bezierPath } from './bezier';
export { blend } from './blend';
export type { HumanizePathOptions } from './humanize-path';
export {
  applyMicroJitter,
  applyVelocityProfile,
  humanizePath,
} from './humanize-path';
export type {
  DwellProfile,
  MouseProfile,
  Personality,
  ReadingProfile,
  ScrollProfile,
  TypingProfile,
} from './personality';
export type {
  ActionResult,
  ActionType,
  HumanAction,
  HumanPlugin,
  KnownActionType,
  PluginContext,
} from './plugin';
export { careful, distracted, fast, precise } from './presets';
export type {
  BoundingBox,
  ComputeReadingDwellOptions,
  PlanReadingScanOptions,
  ReadKind,
} from './reading';
export { computeReadingDwellMs, countWords, planReadingScan } from './reading';
export type {
  PersonalityConfig,
  PersonalityExtension,
  PresetName,
} from './resolve';
export { resolvePersonality } from './resolve';
export type { Rng } from './rng';
export { createRng } from './rng';
export type { PlanScrollOptions, ScrollSegment } from './scroll';
export { planScroll } from './scroll';
export { sleep } from './sleep';
export type { Keystroke, PlanTypingOptions } from './typing';
export { planTypeKeystrokes } from './typing';
