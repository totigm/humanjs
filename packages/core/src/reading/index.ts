import type { ReadingProfile } from '../personality';
import type { Rng } from '../rng';

/**
 * Reading mode. Each kind has a built-in WPM multiplier reflecting real
 * human reading speeds for that content type:
 *  - `'prose'`: 1.0× — regular reading (default)
 *  - `'code'`:  0.4× — every token has meaning, you parse, you don't skim
 *  - `'scan'`:  1.8× — headlines, lists, search results
 *
 * Adapters that resolve `kind` from the page (e.g. detecting a `<pre>` tag)
 * always defer to an explicitly-passed `kind` — auto-detection only fills in
 * when the caller didn't specify.
 */
export type ReadKind = 'prose' | 'code' | 'scan';

const KIND_MULTIPLIER: Record<ReadKind, number> = {
  prose: 1.0,
  code: 0.4,
  scan: 1.8,
};

export interface ComputeReadingDwellOptions {
  /** Reading mode. Default: `'prose'`. */
  readonly kind?: ReadKind;
  /**
   * Custom WPM multiplier — overrides `kind` when set. Use for one-off
   * tuning (e.g. `0.3` for "savor poetry mode" or `4` for "speed scan").
   */
  readonly wpmMultiplier?: number;
  /** Personality tempo multiplier (`personality.speed`). Defaults to 1. */
  readonly personalitySpeed?: number;
  /** Speed-mode multiplier (1 human, 0.5 fast, 0 instant). Defaults to 1. */
  readonly speedFactor?: number;
}

/**
 * Counts whitespace-separated words. Empty / whitespace-only input → 0.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Computes the dwell a humanized reader would spend on `words` words, in ms.
 *
 *   effectiveWpm = profile.wpm × (wpmMultiplier ?? KIND_MULTIPLIER[kind])
 *   base         = (words / effectiveWpm) × 60_000
 *   jittered     = base ± base × profile.jitter × rand[-1, 1]
 *   scaled       = jittered × personalitySpeed × speedFactor
 *
 * Returns 0 for non-positive word counts or non-positive effective WPM.
 */
export function computeReadingDwellMs(
  words: number,
  profile: ReadingProfile,
  rng: Rng,
  options: ComputeReadingDwellOptions = {},
): number {
  if (words <= 0) return 0;

  const kind = options.kind ?? 'prose';
  const multiplier = options.wpmMultiplier ?? KIND_MULTIPLIER[kind];
  const effectiveWpm = profile.wpm * multiplier;
  if (effectiveWpm <= 0) return 0;

  const baseMs = (words / effectiveWpm) * 60_000;
  const jitterMag = baseMs * profile.jitter;
  const offset = rng.nextFloat(-jitterMag, jitterMag);

  const personalitySpeed = options.personalitySpeed ?? 1;
  const speedFactor = options.speedFactor ?? 1;
  return Math.max(0, (baseMs + offset) * personalitySpeed * speedFactor);
}
