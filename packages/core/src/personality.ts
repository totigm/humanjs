/**
 * A complete personality profile describing how a humanized session behaves.
 *
 * Personalities are pure data — they describe the rhythm and shape of
 * humanization without owning any random state. Randomness is supplied
 * per-session by the host, seeded deterministically when needed.
 *
 * Built-in presets and community packages should both satisfy this shape.
 * Community packages are encouraged to publish as `@anything/personality-*`.
 */
export interface Personality {
  /** Identifier used in logs and observability events. */
  readonly name: string;

  /**
   * Overall tempo multiplier applied on top of per-facet timings.
   * 1.0 = base, < 1.0 = faster, > 1.0 = slower.
   */
  readonly speed: number;

  readonly mouse: MouseProfile;
  readonly typing: TypingProfile;
  readonly reading: ReadingProfile;
  readonly dwell: DwellProfile;
}

/** Parameters that shape mouse movement and click behavior. */
export interface MouseProfile {
  /** Bezier curvature factor: 0 = straight line, 1 = exaggerated curves. */
  readonly curvature: number;
  /** Mean travel time in ms per 1000px of distance. */
  readonly travelTimeMs: number;
  /** Random variation in travel time as a fraction of the mean (0..1). */
  readonly travelTimeJitter: number;
  /** Probability of overshooting a target and correcting (0..1). */
  readonly overshootProbability: number;
  /** Probability of clicking slightly off-target and correcting (0..1). */
  readonly misclickProbability: number;
}

/** Parameters that shape keystroke timing and typing errors. */
export interface TypingProfile {
  /** Mean ms between keystrokes. */
  readonly baseDelayMs: number;
  /** Random variation as a fraction of the mean (0..1). */
  readonly delayJitter: number;
  /** Probability of a typo per character (0..1). */
  readonly typoProbability: number;
  /**
   * Probability of correcting a typo with backspace once one occurs (0..1).
   * Lower values leave more uncorrected typos in the output.
   */
  readonly typoCorrectionProbability: number;
  /** Probability of pausing mid-word as if thinking (0..1). */
  readonly thinkPauseProbability: number;
  /** Mean duration of a think-pause in ms. */
  readonly thinkPauseMeanMs: number;
}

/** Parameters that shape reading dwell time. */
export interface ReadingProfile {
  /** Reading speed in words per minute. */
  readonly wpm: number;
  /** Random variation in reading time as a fraction of base (0..1). */
  readonly jitter: number;
}

/** Parameters that shape micro-pauses around actions. */
export interface DwellProfile {
  /** Pause in ms after hovering, before clicking. */
  readonly preClickMs: number;
  /** Random jitter on pre-click pause as a fraction (0..1). */
  readonly preClickJitter: number;
  /** Pause in ms after an action completes. */
  readonly postActionMs: number;
  /** Random jitter on post-action pause as a fraction (0..1). */
  readonly postActionJitter: number;
}
