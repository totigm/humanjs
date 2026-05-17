export const VERSION = '0.0.0';

export { blend } from './blend.js';
export type {
  DwellProfile,
  MouseProfile,
  Personality,
  ReadingProfile,
  TypingProfile,
} from './personality.js';
export type {
  ActionResult,
  ActionType,
  HumanAction,
  HumanPlugin,
  KnownActionType,
  PluginContext,
} from './plugin.js';
export { careful, distracted, fast, precise } from './presets/index.js';
export type {
  PersonalityConfig,
  PersonalityExtension,
  PresetName,
} from './resolve.js';
export { resolvePersonality } from './resolve.js';
export type { Rng } from './rng.js';
export { createRng } from './rng.js';
