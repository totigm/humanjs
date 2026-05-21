import { bezierPath, type Point } from '../bezier';
import { humanizePath } from '../humanize-path';
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

// ───────────────── reading scan path (eye-tracking motion) ─────────────────

/** A bounding box in page-pixel coordinates (matches Playwright's shape). */
export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PlanReadingScanOptions {
  /** Cursor's current position (the scan's starting point). */
  readonly start: Point;
  /**
   * How many horizontal scan lines to draw. Defaults to a height-derived
   * value capped at 4 — 1 line per ~50px of box height, minimum 2.
   */
  readonly lines?: number;
  /** Inner padding from the box edges in pixels. Defaults to 12. */
  readonly paddingPx?: number;
  /** Bezier curvature per segment. Lower = straighter scans. Defaults to 0.15. */
  readonly curvature?: number;
  /** Number of bezier samples per segment. Higher = smoother motion. Defaults to 12. */
  readonly stepsPerSegment?: number;
}

/**
 * Plans a humanized cursor path that traces reading lines across a bounding
 * box — every line sweeps L→R, with a return saccade between lines. Mirrors
 * how real eyes move through prose (left-to-right scripts), not a zigzag
 * snake. Lines are y-centered within proportional bands so the sweeps land
 * on rendered text rather than the box's top and bottom edges.
 *
 * The returned path is a flat sequence of points that an adapter can walk
 * over the reading dwell duration. The chain is built from
 * `bezierPath` + `humanizePath` segments between consecutive waypoints, so
 * the motion has the same micro-jitter and velocity profile as the cursor
 * paths produced by `human.click()`.
 *
 * Pure function: deterministic given the same RNG state and inputs.
 */
/**
 * In-line reading is nearly straight — the eye crosses words left-to-right
 * without arcing above or below the baseline. We use this much-lower
 * curvature for LTR sweeps so the path follows the text, and reserve the
 * `curvature` option (default 0.15) for the entry approach and return
 * saccades between lines, where curve is natural.
 */
const INLINE_SWEEP_CURVATURE = 0.02;

export function planReadingScan(
  box: BoundingBox,
  rng: Rng,
  options: PlanReadingScanOptions,
): readonly Point[] {
  const padding = options.paddingPx ?? 12;
  const curvature = options.curvature ?? 0.15;
  const stepsPerSegment = options.stepsPerSegment ?? 12;

  const innerX = box.x + padding;
  const innerXEnd = box.x + Math.max(box.width - padding, padding);
  const innerY = box.y + padding;
  const innerHeight = Math.max(1, box.height - padding * 2);

  const lineCount = options.lines ?? Math.min(4, Math.max(2, Math.floor(box.height / 50)));

  // Build waypoints: every line sweeps L→R at its band's vertical center, so
  // the path crosses where text actually sits. The bezier segment between
  // (innerXEnd, y_i) and (innerX, y_{i+1}) becomes the return saccade — a
  // natural eye-pattern arc back to the start of the next line.
  const waypoints: Point[] = [];
  for (let i = 0; i < lineCount; i++) {
    const y = innerY + (innerHeight / lineCount) * (i + 0.5);
    waypoints.push({ x: innerX, y });
    waypoints.push({ x: innerXEnd, y });
  }

  // Chain humanized bezier segments between consecutive waypoints, starting
  // from the cursor's current position. Skip the duplicate join point so the
  // sequence is a clean concatenation.
  //
  // Per-segment curvature: the first segment (start → first waypoint) is the
  // entry approach (curves); odd-indexed iterations (1, 3, 5, …) are L→R
  // in-line sweeps (nearly straight); even-indexed iterations after the
  // first are return saccades (curves). Index math: `segIdx % 2 === 1` →
  // in-line; the entry counts as segIdx=0 (saccade-curvature).
  const fullPath: Point[] = [];
  let current = options.start;
  for (let segIdx = 0; segIdx < waypoints.length; segIdx++) {
    const wp = waypoints[segIdx];
    if (!wp) continue;
    const isInlineSweep = segIdx % 2 === 1;
    const segCurvature = isInlineSweep ? INLINE_SWEEP_CURVATURE : curvature;
    const segment = bezierPath(current, wp, rng, {
      curvature: segCurvature,
      steps: stepsPerSegment,
    });
    const humanized = humanizePath(segment, rng, { jitterPx: 0.4, velocityProfile: 0.5 });
    if (fullPath.length === 0) {
      fullPath.push(...humanized);
    } else {
      fullPath.push(...humanized.slice(1));
    }
    current = wp;
  }

  return fullPath;
}
