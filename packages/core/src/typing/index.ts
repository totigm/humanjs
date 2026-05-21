import type { TypingProfile } from '../personality';
import type { Rng } from '../rng';

/**
 * One planned keystroke. Adapters dispatch `key` after sleeping `delayBeforeMs`.
 *
 * `key` is either a single character (e.g. `'a'`) or a named key
 * (e.g. `'Enter'`, `'Backspace'`, `'Tab'`). The two flags let plugins and
 * UI surface error/recovery events without re-deriving them from the stream.
 */
export interface Keystroke {
  readonly key: string;
  readonly delayBeforeMs: number;
  /** True when this key was the WRONG character (a simulated typo). */
  readonly isTypo: boolean;
  /** True when this key is a `'Backspace'` undoing a prior typo. */
  readonly isCorrection: boolean;
}

export interface PlanTypingOptions {
  /**
   * Personality tempo multiplier — typically `personality.speed`.
   * Lower values speed all delays up, higher values slow them down.
   * Defaults to 1.
   */
  readonly personalitySpeed?: number;
  /**
   * Speed-mode multiplier. Adapters typically pass:
   *  - `1` for `'human'`
   *  - `0.5` for `'fast'`
   *  - `0` for `'instant'` (callers usually short-circuit on instant though)
   *
   * Defaults to 1.
   */
  readonly speedFactor?: number;
}

/**
 * Plans the sequence of keystrokes needed to type `value` with the given
 * typing profile. Pure function: given the same RNG state and inputs it
 * returns the same sequence.
 *
 * The planner handles:
 *  - Per-key inter-keystroke rhythm jittered by `delayJitter`
 *  - Optional mid-word "think pauses" (`thinkPauseProbability`)
 *  - Optional QWERTY-adjacent typos (`typoProbability`)
 *  - Optional Backspace recovery (`typoCorrectionProbability`) with a
 *    bimodal perception delay — most typos get noticed fast, some really
 *    do warrant a stare
 *  - Line-ending normalization (`\r` and `\r\n` collapse to `\n`)
 *  - Mapping `\n` → `'Enter'` and `\t` → `'Tab'`
 *
 * Adapters consume the result by sleeping `delayBeforeMs` then dispatching
 * `key` via their platform's keyboard API.
 */
export function planTypeKeystrokes(
  value: string,
  profile: TypingProfile,
  rng: Rng,
  options: PlanTypingOptions = {},
): readonly Keystroke[] {
  const personalitySpeed = options.personalitySpeed ?? 1;
  const speedFactor = options.speedFactor ?? 1;
  const scaling = personalitySpeed * speedFactor;

  // Normalize line endings first — keeps the planning loop straightforward.
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const delay = (mean: number): number => {
    if (mean <= 0) return 0;
    const jitterMag = mean * profile.delayJitter;
    const offset = rng.nextFloat(-jitterMag, jitterMag);
    return Math.max(0, (mean + offset) * scaling);
  };

  const keystrokes: Keystroke[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === undefined) continue;

    // Inter-key rhythm between the previous keystroke and this one.
    // For i === 0 there's no previous keystroke, so no rhythm wait.
    const interKey = i > 0 ? delay(profile.baseDelayMs) : 0;

    // Occasional mid-word "think pause" stacked on top of the rhythm.
    const thinkPause =
      i > 0 && rng.chance(profile.thinkPauseProbability) ? delay(profile.thinkPauseMeanMs) : 0;

    const preDelay = interKey + thinkPause;

    if (isLetter(char) && rng.chance(profile.typoProbability)) {
      const wrongKey = pickAdjacentKey(char, rng);

      if (rng.chance(profile.typoCorrectionProbability)) {
        // Wrong → perception delay → Backspace → correct char.
        // Real typo-noticing is bimodal: ~75% of typos get a short beat,
        // ~25% get a noticeably longer "stare at the screen" pause.
        let perception = delay(profile.baseDelayMs * 2);
        if (rng.chance(0.25)) perception += delay(profile.baseDelayMs * 4);

        keystrokes.push({
          key: wrongKey,
          delayBeforeMs: preDelay,
          isTypo: true,
          isCorrection: false,
        });
        keystrokes.push({
          key: 'Backspace',
          delayBeforeMs: perception,
          isTypo: false,
          isCorrection: true,
        });
        keystrokes.push({
          key: charToKey(char),
          delayBeforeMs: delay(profile.baseDelayMs),
          isTypo: false,
          isCorrection: false,
        });
      } else {
        // Uncorrected typo — the wrong char stays in the output.
        keystrokes.push({
          key: wrongKey,
          delayBeforeMs: preDelay,
          isTypo: true,
          isCorrection: false,
        });
      }
    } else {
      keystrokes.push({
        key: charToKey(char),
        delayBeforeMs: preDelay,
        isTypo: false,
        isCorrection: false,
      });
    }
  }

  return keystrokes;
}

// ───────── helpers ─────────

/**
 * Maps a literal character to a Playwright-style key name. Most chars are
 * accepted verbatim by keyboard APIs; whitespace control chars need named
 * equivalents (`Enter`, `Tab`). Carriage returns are normalized upstream.
 */
function charToKey(char: string): string {
  if (char === '\n') return 'Enter';
  if (char === '\t') return 'Tab';
  return char;
}

function isLetter(char: string): boolean {
  return /^[a-zA-Z]$/.test(char);
}

/**
 * QWERTY adjacency map for typo simulation. For each letter, returns one of
 * its physical neighbors picked uniformly at random — that's how real
 * fat-fingered mistakes look. Case is preserved (a capital `H` typo
 * produces a capital `G`).
 *
 * Only US-QWERTY for now; community personalities can layer their own
 * layouts on top once the plugin system grows.
 */
const QWERTY_ADJACENCY: Readonly<Record<string, string>> = {
  q: 'wa',
  w: 'qeas',
  e: 'wrsd',
  r: 'etdf',
  t: 'ryfg',
  y: 'tugh',
  u: 'yihj',
  i: 'uojk',
  o: 'ipkl',
  p: 'ol',
  a: 'qwsz',
  s: 'awedxz',
  d: 'serfxc',
  f: 'drtgcv',
  g: 'ftyhvb',
  h: 'gyujbn',
  j: 'huiknm',
  k: 'jiolm',
  l: 'kop',
  z: 'asx',
  x: 'zsdc',
  c: 'xdfv',
  v: 'cfgb',
  b: 'vghn',
  n: 'bhjm',
  m: 'njk',
};

function pickAdjacentKey(char: string, rng: Rng): string {
  const lower = char.toLowerCase();
  const neighbors = QWERTY_ADJACENCY[lower];
  if (!neighbors || neighbors.length === 0) return char;
  const picked = neighbors[rng.nextInt(0, neighbors.length)];
  if (!picked) return char;
  return char === lower ? picked : picked.toUpperCase();
}
