import type {
  DwellProfile,
  MouseProfile,
  Personality,
  ReadingProfile,
  TypingProfile,
} from './personality.js';
import { careful, distracted, fast, precise } from './presets/index.js';

/** Names of the four built-in personality presets. */
export type PresetName = 'careful' | 'distracted' | 'fast' | 'precise';

const presets: Record<PresetName, Personality> = {
  careful,
  distracted,
  fast,
  precise,
};

/**
 * A preset extended with partial overrides at the top level and on any
 * facet. Unspecified fields fall through to the base preset.
 */
export interface PersonalityExtension {
  readonly extends: PresetName;
  readonly name?: string;
  readonly speed?: number;
  readonly mouse?: Partial<MouseProfile>;
  readonly typing?: Partial<TypingProfile>;
  readonly reading?: Partial<ReadingProfile>;
  readonly dwell?: Partial<DwellProfile>;
}

/**
 * Anything that can be passed where a personality is expected.
 * - A preset name (`'careful'`, `'fast'`, …)
 * - A preset + partial overrides via `{ extends: 'careful', … }`
 * - A fully built `Personality` (community packages, results of `blend()`)
 */
export type PersonalityConfig = PresetName | PersonalityExtension | Personality;

/**
 * Resolves any `PersonalityConfig` into a flat `Personality`.
 *
 * Never mutates the base preset — overrides produce a fresh object. The
 * returned `Personality` is safe to share, snapshot, and pass to
 * `createHuman()` or `blend()`.
 */
export function resolvePersonality(config: PersonalityConfig): Personality {
  if (typeof config === 'string') {
    return presets[config];
  }
  if ('extends' in config) {
    const base = presets[config.extends];
    return {
      name: config.name ?? base.name,
      speed: config.speed ?? base.speed,
      mouse: { ...base.mouse, ...config.mouse },
      typing: { ...base.typing, ...config.typing },
      reading: { ...base.reading, ...config.reading },
      dwell: { ...base.dwell, ...config.dwell },
    };
  }
  return config;
}
