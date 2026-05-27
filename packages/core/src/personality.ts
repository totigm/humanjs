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
  readonly scroll: ScrollProfile;
  readonly dwell: DwellProfile;
}

/** Parameters that shape mouse movement and click behavior. */
export interface MouseProfile {
  /** Bezier curvature factor: 0 = straight line, 1 = exaggerated curves. */
  readonly curvature: number;
  /** Mean travel time in ms per 1000px of distance. */
  readonly travelTimeMs: number;
  /**
   * Random variation as a fraction of `travelTimeMs`. `0.2` means each move
   * takes `travelTimeMs × [0.8, 1.2]`. Range: `[0, 1]`; `0` disables variation.
   */
  readonly travelTimeJitter: number;
  /** Probability of overshooting a target and correcting (0..1). */
  readonly overshootProbability: number;
  /**
   * Probability per click action of producing the visible "near-miss"
   * cursor wobble (0..1). When it fires, the cursor walks to a point just
   * outside the target's bounding box, dwells briefly (the "oh, I missed"
   * beat), then walks to the real click point. **No click is dispatched
   * at the off-target coordinates** — the misclick is purely visual cursor
   * motion, so it never triggers handlers on ancestors or siblings.
   *
   * This is process humanization, not outcome change: `human.click(target)`
   * still lands its click on `target`, with `button` and assertions
   * unchanged. The only differences are the cursor's path (it makes a
   * brief detour) and the action's total duration (slightly longer).
   *
   * Skipped automatically when the target sits at the viewport edge and
   * the candidate misclick point would have to land off-screen.
   */
  readonly misclickProbability: number;
  /**
   * Click-point spread inside the target's bounding box, as a fraction of
   * each dimension. The click point is a 2D Gaussian centered on the box,
   * with standard deviation `dimension × clickSpread`. Higher = looser
   * cluster (more variation from center); lower = tighter cluster.
   * Typical range: `0.10` (precise) to `0.20` (distracted). Clamped to the
   * box, so values above `~0.5` start hitting the edges constantly.
   */
  readonly clickSpread: number;
}

/** Parameters that shape keystroke timing and typing errors. */
export interface TypingProfile {
  /** Mean ms between keystrokes. */
  readonly baseDelayMs: number;
  /**
   * Random variation as a fraction of `baseDelayMs`. `0.3` means each
   * keystroke is delayed `baseDelayMs × [0.7, 1.3]`. Range: `[0, 1]`;
   * `0` disables variation.
   */
  readonly delayJitter: number;
  /** Probability of a typo per character (0..1). */
  readonly typoProbability: number;
  /**
   * Probability of correcting a typo with backspace once one occurs (0..1).
   *
   * All built-in presets ship `1.0` — the library's default contract is
   * "the value you pass to `human.type()` lands in the field as-is."
   * Personality controls *how* the value is typed (rate of mid-typing
   * stumbles, key delays, think pauses), not *what* lands.
   *
   * Lower this — with eyes open — only when you specifically want the
   * simulation to leave occasional uncorrected typos (stress-testing form
   * validation under noisy input, modeling truly inattentive users, etc.).
   * Output stays deterministic given a fixed `seed`, but with `< 1.0` the
   * final field-value becomes **seed-dependent**: change the seed and the
   * surviving typos shift, which is rarely what tests or agents want.
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
  /**
   * Random variation as a fraction of the base reading time. `0.2` means
   * the dwell ends up `base × [0.8, 1.2]`. Range: `[0, 1]`; `0` disables
   * variation.
   */
  readonly jitter: number;
}

/** Parameters that shape scroll behavior. */
export interface ScrollProfile {
  /**
   * Wheel-event density: how many segments per 1000 px of scroll distance.
   * More = smoother visible motion at higher CDP overhead. Real-world
   * trackpad / wheel rolls land somewhere around 20–40 events per 1000 px.
   */
  readonly segmentsPerKpx: number;
  /** Mean delay in ms between successive wheel events. */
  readonly segmentDelayMs: number;
  /**
   * Random variation as a fraction of `segmentDelayMs`. `0.3` means each
   * inter-segment delay is `segmentDelayMs × [0.7, 1.3]`. Range: `[0, 1]`.
   */
  readonly segmentDelayJitter: number;
  /** Probability of inserting a mid-scroll micro-pause (0..1). */
  readonly pauseProbability: number;
  /** Mean duration of a mid-scroll pause in ms. */
  readonly pauseMs: number;
  /** Jitter on `pauseMs`. Range: `[0, 1]`. */
  readonly pauseMsJitter: number;
  /** Probability of overshooting the target and correcting (0..1). */
  readonly overshootProbability: number;
  /**
   * Magnitude of overshoot as a fraction of the total scroll distance.
   * `0.1` means a 1000 px scroll would overshoot by ~100 px before
   * correcting back. Range: `[0, 0.5]` is sensible; clamped internally.
   */
  readonly overshootRatio: number;
}

/** Parameters that shape micro-pauses around actions. */
export interface DwellProfile {
  /** Pause in ms after hovering, before clicking. */
  readonly preClickMs: number;
  /**
   * Random variation as a fraction of `preClickMs`. `0.3` means each pause
   * is `preClickMs × [0.7, 1.3]`. Range: `[0, 1]`; `0` disables variation.
   */
  readonly preClickJitter: number;
  /** Pause in ms after an action completes. */
  readonly postActionMs: number;
  /**
   * Random variation as a fraction of `postActionMs`. `0.3` means each pause
   * is `postActionMs × [0.7, 1.3]`. Range: `[0, 1]`; `0` disables variation.
   */
  readonly postActionJitter: number;
}
