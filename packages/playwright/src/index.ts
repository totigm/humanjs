import {
  type ActionResult,
  createRng,
  type HumanAction,
  type HumanPlugin,
  type Personality,
  type PersonalityConfig,
  type PluginContext,
  type Point,
  resolvePersonality,
  sleep,
} from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import {
  executeSelectOption,
  executeSetChecked,
  executeUpload,
  type SelectOptionValues,
  type UploadFiles,
} from './forms';
import { selectSubstringInElement } from './internal/select-substring';
import { executeClear, executePaste, executePress, executeType, type KeyOrChord } from './keyboard';
import { executeClick, executeDrag, executeHover, executeMove, type MouseTarget } from './mouse';
import { type InstallMouseHelperOptions, installMouseHelper } from './mouse-helper';
import { executeRead, type ReadOptions, type ReadResult, type ReadTarget } from './reading';
import {
  getCaptureSettingsForQuality,
  Recording,
  type RecordingQuality,
  type TimelineEvent,
} from './recording';
import { startCapture } from './recording/capture';
import { executeScroll, type ScrollOptions, type ScrollResult, type ScrollTarget } from './scroll';

export type {
  ActionResult,
  ActionType,
  BezierPathOptions,
  ComputeReadingDwellOptions,
  DwellProfile,
  HumanAction,
  HumanizePathOptions,
  HumanPlugin,
  Keystroke,
  KnownActionType,
  MouseProfile,
  Personality,
  PersonalityConfig,
  PersonalityExtension,
  PlanTypingOptions,
  PluginContext,
  Point,
  PresetName,
  ReadingProfile,
  ReadKind,
  Rng,
  ScrollProfile,
  ScrollSegment,
  TypingProfile,
} from '@humanjs/core';
// Re-exports of the public core API so consumers have one import surface.
export {
  applyMicroJitter,
  applyVelocityProfile,
  bezierPath,
  blend,
  careful,
  computeReadingDwellMs,
  countWords,
  createRng,
  distracted,
  fast,
  humanizePath,
  planScroll,
  planTypeKeystrokes,
  precise,
  resolvePersonality,
  sleep,
} from '@humanjs/core';
// Playwright primitives re-exported for one-import convenience. These are
// the unmodified upstream values/types — `@humanjs/playwright` is a
// Playwright integration, so users shouldn't have to dual-import for the
// common case. Add more re-exports here only when a real user need shows
// up; the goal is "covers 95% of demo/test code," not "mirrors all of
// playwright."
export {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  chromium,
  type ElementHandle,
  firefox,
  type LaunchOptions,
  type Locator,
  type Page,
  webkit,
} from 'playwright';
export type { SelectOptionValues, UploadFiles } from './forms';
export type { KeyModifier, KeyName, KeyOrChord, PressResult } from './keyboard';
export type { MouseTarget } from './mouse';
export type { InstallMouseHelperOptions } from './mouse-helper';
export { installMouseHelper } from './mouse-helper';
export type { ReadOptions, ReadResult, ReadTarget } from './reading';
export {
  type FfmpegPreset,
  type FfmpegTune,
  generateHumanJS,
  generatePlaywrightTest,
  type PlaywrightTestOptions,
  Recording,
  type RecordingQuality,
  type RecordReplayOptions,
  type ReplayOptions,
  type ReplayResult,
  type ReplayStepResult,
  type ReplayStepUpdate,
  recordReplay,
  replayTimeline,
  type Timeline,
  type TimelineEvent,
  type ToGifOptions,
  type ToVideoOptions,
} from './recording';
export type { ScrollOptions, ScrollResult, ScrollTarget } from './scroll';

/** Options for {@link Human.selectText}. */
export interface SelectTextOptions {
  /**
   * Select only this substring of the element's text instead of all of it.
   * Located inside the element whitespace-tolerantly (first match); falls back
   * to selecting the whole element when not found.
   */
  text?: string;
}

/**
 * How fast the humanized session runs.
 * - `'human'` — full humanization (default)
 * - `'fast'` — humanized but accelerated
 * - `'instant'` — bypass all humanization, straight Playwright
 */
export type Speed = 'fast' | 'human' | 'instant';

/** Options for {@link createHuman}. */
export interface CreateHumanOptions {
  /** Personality preset, extension, or fully built personality. Defaults to `'careful'`. */
  readonly personality?: PersonalityConfig;
  /** Seed for the session's PRNG. Same seed produces identical trajectories. */
  readonly seed?: number | string;
  /** Speed mode. Defaults to `'human'`. */
  readonly speed?: Speed;
  /** Plugins installed on this session, invoked in registration order. */
  readonly plugins?: readonly HumanPlugin[];
  /**
   * Visual cursor overlay ({@link installMouseHelper}) so humanized motion is
   * visible in headed runs and recordings. **On by default.** Pass `false` to
   * opt out — do this for `speed: 'instant'` / CI, where there's no motion to
   * show and the injected cursor would land in test DOM and screenshots. Pass
   * an options object to style it (color, size, …).
   */
  readonly cursor?: boolean | InstallMouseHelperOptions;
  /**
   * Starting cursor position used as the origin of the first humanized path.
   * Defaults to `{ x: 0, y: 0 }`. Set this if you've already moved the cursor
   * (e.g. via `page.mouse.move`) before creating the session, so the first
   * click's path starts from the correct location.
   */
  readonly initialMousePosition?: Point;
}

/** A humanized Playwright session bound to a single `Page`. */
export interface Human {
  /** The resolved personality this session is using. */
  readonly personality: Personality;
  /** The speed mode this session was created with. */
  readonly speed: Speed;
  /**
   * Navigate to `url`. Plugins observe the action via `'goto'`; the underlying
   * `page.goto(url)` is awaited unchanged.
   */
  goto(url: string): Promise<void>;
  /**
   * Move the mouse along a humanized Bezier path to `target` and click.
   *
   * `target` accepts a Playwright-compatible selector string (e.g.
   * `'button:has-text("Buy now")'`), a built `Locator`, or a raw `Point`.
   * For element targets the click point is Gaussian-distributed around the
   * center; for a raw `Point` the exact coordinates are clicked. The
   * `Point` form is the fallback for things with no clean selector —
   * icon-only buttons, canvas, SVG — where you can see the pixel position
   * but can't address the element.
   *
   * In `speed: 'instant'`, all humanization is skipped: element targets use
   * Playwright's native `locator.click()`; a `Point` dispatches one
   * `mouse.click()` at the coordinates.
   */
  click(target: MouseTarget): Promise<void>;
  /**
   * Right-click `target` — opens a native context menu. Same Bezier-path
   * motion and hover dwell as `click()`; only the dispatched button differs.
   * Accepts the same selector / `Locator` / `Point` targets as `click()`.
   *
   * In `speed: 'instant'`, element targets fall back to
   * `locator.click({ button: 'right' })`; a `Point` dispatches one
   * `mouse.click({ button: 'right' })` at the coordinates.
   */
  rightClick(target: MouseTarget): Promise<void>;
  /**
   * Double-click `target`. Identical humanized approach to `click()` — same
   * Bezier path, hover dwell, and occasional near-miss — but the final
   * dispatch is a double-click (two presses within the OS double-click
   * window). Accepts the same selector / `Locator` / `Point` targets.
   *
   * In `speed: 'instant'`, element targets fall back to
   * `locator.click({ clickCount: 2 })`; a `Point` dispatches
   * `mouse.click(x, y, { clickCount: 2 })`.
   */
  doubleClick(target: MouseTarget): Promise<void>;
  /**
   * Move the cursor to `target` along a humanized Bezier path and settle
   * on it — no click is dispatched. Useful for hover-triggered UI
   * (tooltips, dropdowns), for positioning the cursor before a non-target
   * action, or for visible demos where the cursor should pause on
   * something noteworthy.
   *
   * In `speed: 'instant'`, dispatches one `mouse.move()` to the element's
   * center.
   */
  hover(target: Locator | string): Promise<void>;
  /**
   * Move the cursor to `target` along a humanized Bezier path. Pure
   * positioning — no settle dwell, no element interaction. `target` accepts
   * a CSS selector, a `Locator`, or a literal `Point`; the `Point` form
   * lets you position the cursor anywhere (canvas, SVG, dead space) without
   * a DOM element to anchor on.
   *
   * Distinct from `hover()`: `hover` is element-bound and includes a settle
   * dwell to let hover-state UI fire (tooltips, dropdowns). `move` is
   * positional only — use it when you want the cursor placed somewhere
   * without implying interaction with what's under it (pre-press
   * placement, canvas painting, cinematic beats).
   *
   * In `speed: 'instant'`, dispatches one `mouse.move()` at the resolved
   * coordinates.
   */
  move(target: MouseTarget): Promise<void>;
  /**
   * Drag from `from` to `to`. Each endpoint accepts a CSS selector, a
   * `Locator`, or a literal `Point` — the last form matters for canvas /
   * SVG / slider drags where the destination isn't a DOM element.
   *
   * The motion is two humanized paths back-to-back: cursor → source,
   * then source → destination with the left button held throughout.
   *
   * In `speed: 'instant'`, dispatches `mouse.down → move → up` at the
   * resolved coordinates without humanized motion.
   */
  drag(from: MouseTarget, to: MouseTarget): Promise<void>;
  /**
   * Type `value` into `target` with humanized per-key timing, optional typo
   * injection (with backspace recovery), and occasional think-pauses.
   *
   * Per-key `keydown`/`press`/`up` events fire for each character, so
   * handlers like autocomplete dropdowns still receive every keystroke.
   *
   * In `speed: 'instant'`, falls back to `locator.pressSequentially` with
   * zero inter-key delay — events still fire, but humanization is skipped.
   */
  type(target: Locator | string, value: string): Promise<void>;
  /**
   * Insert `value` into `target` in one shot — the Cmd-V semantic. No
   * per-character timing. Like `type()`, drives an implicit click to focus
   * the field first; unlike `type()`, dispatches the whole value via
   * `keyboard.insertText` rather than per-key presses.
   *
   * Use this for long strings (code blocks, multi-line content, secrets)
   * where the typing simulation would be slow and unnecessary. If you need
   * the page's `paste` event handler to fire, call `human.press('Mod+V')`
   * after setting clipboard contents yourself.
   *
   * In `speed: 'instant'`, behaves identically — paste is already instant
   * by nature.
   */
  paste(target: Locator | string, value: string): Promise<void>;
  /**
   * Clear a text field `target` (input, textarea, or contenteditable) with a
   * humanized gesture: click to focus, **select-all**, a beat, then **delete**
   * — the real keyboard motion a person uses to wipe a field before retyping,
   * not a silent value reset. Fires the keydown/up + `input` events the page
   * expects.
   *
   * Pair with `type()` to edit an existing value:
   * `await human.clear('#name'); await human.type('#name', 'New');`
   *
   * In `speed: 'instant'`, delegates to Playwright's native `locator.clear()`.
   */
  clear(target: Locator | string): Promise<void>;
  /**
   * Tick a checkbox or radio `target`. Moves the cursor to the control and
   * clicks it with the same humanized motion as `click()` — but only when
   * needed: if it already reports checked, no click fires (a real user
   * doesn't re-click a box that's already ticked). The resulting state is
   * verified; trying to `check` something that won't toggle throws.
   *
   * `target` is element-bound (selector or `Locator`). In `speed: 'instant'`,
   * delegates to Playwright's native `locator.check()`.
   */
  check(target: Locator | string): Promise<void>;
  /**
   * Untick a checkbox `target`. Mirror of `check()` — humanized click only if
   * currently checked, with state verification afterward. Radios can't be
   * unchecked by clicking (select a different option instead); attempting it
   * throws a clear error.
   *
   * In `speed: 'instant'`, delegates to `locator.uncheck()`.
   */
  uncheck(target: Locator | string): Promise<void>;
  /**
   * Choose option(s) in a native `<select>` `target`. The cursor moves to the
   * dropdown and settles on it (humanized), then the value is set — native
   * selects open an OS menu automation can't drive visually, so the *approach*
   * is humanized while the choice itself is set programmatically (firing
   * `input`/`change`), exactly as Playwright does. For custom DOM dropdowns,
   * drive the rendered options with `click` instead.
   *
   * `values` takes the Playwright `selectOption` shape — a value string, an
   * array of values, or `{ value | label | index }`. Returns the option
   * values that ended up selected.
   *
   * In `speed: 'instant'`, sets the value with no cursor motion.
   */
  selectOption(target: Locator | string, values: SelectOptionValues): Promise<string[]>;
  /**
   * Select text inside `target` (a paragraph, heading, input, …). The cursor
   * moves to the element (humanized), then the text is highlighted — the
   * "select this" gesture before copying, replacing, or triggering a highlight
   * menu.
   *
   * By default the element's whole text is selected. Pass `{ text }` to select
   * just that substring: HumanJS finds it inside the element (whitespace-
   * tolerant, mapped to exact offsets, first match) and selects only that
   * range — so a recorded partial highlight reproduces as itself, not the whole
   * element. If the text can't be located, it falls back to selecting all of
   * the element.
   *
   * `target` is element-bound (selector or `Locator`). In `speed: 'instant'`
   * the cursor motion is skipped; the selection is still applied.
   */
  selectText(target: Locator | string, options?: SelectTextOptions): Promise<void>;
  /**
   * Attach file(s) to a file-input `target`. The cursor moves to the control
   * (visible in recordings / the overlay), then the files are attached via
   * `setInputFiles`. Unlike a real click this never opens the OS file dialog
   * (which would hang) — files are set directly, the way Playwright models
   * uploads.
   *
   * `target` should be the `<input type="file">`. For the common hidden-input-
   * behind-a-styled-button pattern there's no visible control to approach, so
   * the motion is skipped and the files are attached directly. `files` takes
   * the Playwright `setInputFiles` shape (a path, an array of paths, or
   * in-memory `{ name, mimeType, buffer }` payloads).
   *
   * In `speed: 'instant'`, attaches the files with no cursor motion.
   */
  upload(target: Locator | string, files: UploadFiles): Promise<void>;
  /**
   * Press a single key (`'Tab'`, `'Enter'`, `'Escape'`, `'ArrowDown'`, …)
   * or a keyboard chord (`'Mod+S'`, `'Cmd+Shift+P'`, `'Ctrl+C'`, …).
   *
   * Modifier rules:
   *
   * - `Mod` / `CmdOrCtrl` / `CommandOrControl` — magic: `Meta` on Mac,
   *   `Control` elsewhere. Use for cross-platform app shortcuts. The three
   *   are aliases; `Mod` is shortest.
   * - `Cmd`, `Command`, `Meta`, `Win`, `Super` — literal `Meta` keycode
   *   (Command on Mac, Windows key on Windows, Super on Linux).
   * - `Ctrl`, `Control` — literal Control. Stays Control on every OS.
   * - `Alt`, `Option`, `Opt` — literal Alt.
   * - `Shift` — literal Shift.
   *
   * Case-insensitive. Throws on unknown modifiers. The `KeyOrChord` type
   * is a template-literal union of every modifier × key combination (up to
   * two literal modifiers + a key), so IDEs autocomplete common bare keys
   * and chords as you type. Less common keys (`BracketLeft`, `NumpadAdd`,
   * locale-specific keys) still typecheck through the union's string
   * escape hatch — they just don't autocomplete.
   *
   * Does **not** move the cursor — keyboard input dispatches against
   * focus, not cursor position. Compose with `click` / `hover` / `move`
   * when you need both.
   */
  press(key: KeyOrChord): Promise<void>;
  /**
   * Dwell as if reading `target` — the third pillar of humanization after
   * the cursor and the keyboard. Real users pause to read; HumanJS models
   * that pause from word count + the personality's reading WPM (+ jitter).
   *
   * **Targets:**
   *  - `string`: a Playwright-compatible selector (matches `click()`/`type()`).
   *  - `Locator`: a pre-built Locator.
   *  - `{ text }`: literal text in hand (no DOM lookup).
   *  - `{ words }`: pre-counted — skip text extraction entirely.
   *
   * **Smart defaults** (only when the caller doesn't override):
   *  - `kind` auto-detects as `'code'` for `<pre>` and `<code>` tags;
   *    everything else falls back to `'prose'`. Explicit `kind` always wins.
   *  - `scrollIntoView: false` — most flows already scrolled to the content.
   *
   * Plugins observe `'read'` actions with `{ target, words, kind }` in params.
   * The text content itself is never echoed — passwords, tokens, and other
   * sensitive strings stay out of telemetry by default.
   *
   * In `speed: 'instant'`, dwell collapses to 0 ms but the action still fires
   * so observability stays consistent.
   *
   * Returns a {@link ReadResult} with the word count, final kind (after
   * auto-detection), and total dwell duration — useful for assertions in
   * tests or for surfacing reading metadata to a UI.
   */
  read(target: ReadTarget, options?: ReadOptions): Promise<ReadResult>;
  /**
   * Scroll the page (or a scrollable container) humanly. Multi-segment
   * motion with a bell-curve velocity profile, optional mid-scroll
   * micro-pauses, and (for the `distracted` personality) the occasional
   * overshoot + correction.
   *
   * **Targets:**
   *  - `'natural'` (default): scroll one viewport in the chosen axis
   *  - `'end'` / `'top'`: jump to the document/container edges, humanized
   *  - `string`: a Playwright-compatible selector — scroll until in view
   *  - `Locator`: same, but with a pre-built handle
   *  - `{ by: n }`: relative pixel delta (negative = up / left)
   *  - `{ to: n }`: absolute scroll position on the chosen axis
   *
   * **Options:** `axis: 'x' | 'y'` (default `'y'`) picks the direction;
   * `within: selector | Locator` scopes the scroll to a scrollable
   * container; `block: 'start' | 'center' | 'end' | 'nearest'` aligns
   * element targets; `overshoot` / `withPauses` toggle individual
   * humanization signals.
   *
   * Plugins observe `'scroll'` actions with `{ target }` in
   * `beforeAction`'s params (a human-readable description of the target).
   * The full {@link ScrollResult} (`from` / `to` / `distance` /
   * `durationMs`) is available via `afterAction`'s `result` argument.
   *
   * In `speed: 'instant'`, the page (or container) is moved with a single
   * `scrollTo` call. No wheel events, no segments — but the action still
   * fires for observability.
   *
   * Returns a {@link ScrollResult} for assertions in tests.
   */
  scroll(target?: ScrollTarget, options?: ScrollOptions): Promise<ScrollResult>;
  /**
   * Pause for `ms` milliseconds. Equivalent to importing `sleep` from
   * `@humanjs/playwright` and calling it — exposed on the Human instance
   * so users who already have `human` in scope don't need an extra import.
   *
   * Not a humanized action: this is a raw `setTimeout` wait, not scaled
   * by personality or speed mode, and no plugin events fire. Use it for
   * generic pacing between humanized actions.
   */
  sleep(ms: number): Promise<void>;
  /**
   * Records `fn`'s actions. Returns a {@link Recording} you can export
   * to mp4/webm video (`toVideo`), JSON timeline (`toTimeline`), or both.
   *
   * By default, frames are captured from the browser via timer-polled
   * `page.screenshot()` — fully controllable quality, not limited by
   * Playwright's recordVideo bitrate ceiling. Pass `{ video: false }` to
   * skip capture entirely (timeline-only mode, zero video overhead).
   *
   * Plugins observe `'record'` in `beforeAction` / `afterAction` so
   * recording shows up alongside the other primitives in observability
   * pipelines.
   *
   * Single-use per session: `Recording.toVideo()` finalizes the captured
   * frames, so calling `human.record()` twice on the same human throws.
   *
   * @example
   * ```ts
   * // Default: video + timeline
   * const rec = await human.record(async () => {
   *   await human.click('#login');
   * });
   * await rec.toVideo('demo.mp4');
   * await rec.toTimeline('demo.json');
   *
   * // Timeline-only, no video overhead
   * const rec = await human.record({ video: false }, async () => {
   *   await human.click('#login');
   * });
   * await rec.toTimeline('demo.json');
   * ```
   */
  record(fn: () => Promise<void>): Promise<Recording>;
  record(options: HumanRecordOptions, fn: () => Promise<void>): Promise<Recording>;

  // ────────────────────────────────────────────────────────────────────
  // Thin re-exports of common Playwright `Page` methods, for ergonomic
  // coherence (`human.*` is the single surface a user thinks about). No
  // humanization happens here — these are pure forwards. Navigation
  // actions fire plugin events; read-only state queries and waits do not.
  // ────────────────────────────────────────────────────────────────────

  /**
   * Take a screenshot of the page. Forwards to `page.screenshot(options)`
   * unchanged — see Playwright docs for the full options shape.
   *
   * Not a humanized action: no plugin events fire. Pure ergonomic
   * re-export so `human.*` stays a single surface.
   */
  screenshot(options?: Parameters<Page['screenshot']>[0]): Promise<Buffer>;
  /**
   * Visible text content of the page (`document.body.innerText`). Forwards
   * to `page.innerText('body')`. Useful for AI agents that need to
   * understand what's on screen without parsing HTML.
   *
   * For a region instead of the whole page, use `page.innerText(selector)`.
   *
   * Not a humanized action: no plugin events fire.
   */
  pageText(): Promise<string>;
  /**
   * Full HTML of the page. Forwards to `page.content()`. Often large
   * (50–500 KB on typical sites) — prefer {@link Human.pageText} when
   * passing to an LLM unless structure matters.
   *
   * Not a humanized action: no plugin events fire.
   */
  content(): Promise<string>;
  /**
   * Accessibility-tree **outline** of the page (or a region) — every
   * interactive element and landmark by its ARIA role + accessible name,
   * rendered as compact YAML (Playwright's `ariaSnapshot`). The most
   * token-efficient way for an AI agent to see what's actionable and pick a
   * selector: the names map directly to `getByRole` / accessible-name
   * selectors, which HumanJS already favors.
   *
   * Prefer this over {@link Human.content} when the question is "what can I
   * click / fill"; reach for {@link Human.screenshot} when you need the
   * visual layout. Pass `target` to scope the outline to a region.
   *
   * Not a humanized action: no plugin events fire. Requires Playwright ≥ 1.49
   * (when `ariaSnapshot` landed).
   */
  outline(target?: Locator | string): Promise<string>;
  /**
   * Current URL of the page. Forwards to `page.url()`. Synchronous return
   * because Playwright's underlying API is sync.
   *
   * Not a humanized action: no plugin events fire.
   */
  url(): string;
  /**
   * Current document title. Forwards to `page.title()`.
   *
   * Not a humanized action: no plugin events fire.
   */
  title(): Promise<string>;
  /**
   * Reload the current page. Forwards to `page.reload(options)`. Real-user
   * analog of hitting the refresh button — the click motion is *not*
   * humanized (we treat reload as navigation, not a cursor action).
   *
   * Plugins observe a `'reload'` action.
   */
  reload(options?: Parameters<Page['reload']>[0]): Promise<void>;
  /**
   * Navigate back in the browser history. Forwards to `page.goBack(options)`.
   *
   * Plugins observe a `'goBack'` action.
   */
  goBack(options?: Parameters<Page['goBack']>[0]): Promise<void>;
  /**
   * Navigate forward in the browser history. Forwards to
   * `page.goForward(options)`.
   *
   * Plugins observe a `'goForward'` action.
   */
  goForward(options?: Parameters<Page['goForward']>[0]): Promise<void>;
  /**
   * Wait until the page reaches the specified load state. Forwards to
   * `page.waitForLoadState(state, options)`. Common after a humanized
   * click that triggers navigation — gives the page time to settle before
   * the next action.
   *
   * Not a humanized action: no plugin events fire.
   */
  waitForLoadState(
    state?: Parameters<Page['waitForLoadState']>[0],
    options?: Parameters<Page['waitForLoadState']>[1],
  ): Promise<void>;
  /**
   * Wait until the page's URL matches `url` (string, RegExp, or predicate).
   * Forwards to `page.waitForURL(url, options)`. Common post-action wait
   * (e.g. after `human.click('#login')`, wait for `/dashboard`).
   *
   * Not a humanized action: no plugin events fire.
   */
  waitForURL(
    url: Parameters<Page['waitForURL']>[0],
    options?: Parameters<Page['waitForURL']>[1],
  ): Promise<void>;
  /**
   * Resize the viewport. Forwards to `page.setViewportSize(size)`. Useful
   * for testing responsive layouts or switching between breakpoints
   * mid-session.
   *
   * Not a humanized action: no plugin events fire.
   */
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  /**
   * Emulate CSS media features — `prefers-reduced-motion`,
   * `prefers-color-scheme`, `forced-colors`, `prefers-contrast`, and print
   * media. Forwards to `page.emulateMedia(options)`.
   *
   * The reduced-motion branch of a UI is normally impossible to exercise
   * without changing an OS setting, so it tends to ship unverified even in
   * projects that wrote it carefully. This makes it one call:
   *
   * ```ts
   * await human.emulateMedia({ reducedMotion: 'reduce' });
   * await human.goto(url);            // now renders the reduced-motion path
   * ```
   *
   * Settings persist across navigations until changed. Pass `null` for a
   * feature to stop emulating it and fall back to the host's own setting.
   *
   * Not a humanized action: no plugin events fire.
   */
  emulateMedia(options: Parameters<Page['emulateMedia']>[0]): Promise<void>;
  /**
   * Render the page as a PDF. Forwards to `page.pdf(options)`. Chromium
   * only; works most reliably in headless mode (in headed mode, Playwright
   * silently switches to a print-style render).
   *
   * Not a humanized action: no plugin events fire.
   */
  pdf(options?: Parameters<Page['pdf']>[0]): Promise<Buffer>;
}

/** Options for {@link Human.record}. */
export interface HumanRecordOptions {
  /**
   * Optional label for the recording. Stored on the timeline and used as the
   * title of a generated `toPlaywright()` test.
   */
  readonly name?: string;
  /**
   * Whether to capture frames for video output. Defaults to `true`.
   * Set to `false` for timeline-only recordings (no capture loop, no
   * temp files, no encoding overhead — `toTimeline()` still works).
   */
  readonly video?: boolean;
  /**
   * Capture quality preset. Controls per-frame JPEG quality (or PNG for
   * lossless) AND the ffmpeg encode settings used by `toVideo()`.
   * Defaults to `'high'`. Ignored when `video: false`.
   */
  readonly quality?: RecordingQuality;
  /**
   * Capture the actual typed/pasted text into the timeline (and therefore
   * into code generated by `toHumanJS()` / `toPlaywright()`). Defaults to
   * `true`.
   *
   * Values typed/pasted into `input[type="password"]` are always masked
   * (omitted) regardless of this flag — the video already renders them as
   * dots, and freezing a cleartext secret into an artifact would leak more
   * than the recording itself. Set `false` to record no input values at all;
   * exporters then emit empty-string placeholders.
   *
   * Captured values land in the timeline JSON and any exported test, so treat
   * those artifacts with the same care as the values themselves.
   */
  readonly captureInputs?: boolean;
}

/**
 * Creates a humanized session bound to a Playwright `Page`.
 *
 * @example
 * ```ts
 * import { chromium } from 'playwright';
 * import { createHuman } from '@humanjs/playwright';
 *
 * const browser = await chromium.launch();
 * const page = await browser.newPage();
 *
 * const human = await createHuman(page, {
 *   personality: 'careful',
 *   seed: 'session-42',
 * });
 *
 * await human.goto('https://example.com');
 * ```
 */
export async function createHuman(page: Page, options: CreateHumanOptions = {}): Promise<Human> {
  const personality = resolvePersonality(options.personality ?? 'careful');
  const rng = createRng(options.seed);
  const speed = options.speed ?? 'human';
  const plugins = options.plugins ?? [];

  const context: PluginContext = { personality, rng };
  for (const plugin of plugins) {
    await plugin.install?.(context);
  }

  // Visual cursor overlay, on by default so humanized motion is visible in
  // headed runs and recordings. Opt out with `cursor: false` (do this for
  // `speed: 'instant'` / CI). Scoped to this page; idempotent, so a manual
  // `installMouseHelper` or the MCP server's install is harmless on top. The
  // capability check keeps it from touching partial page mocks in unit tests —
  // a real Playwright `Page` always has `addInitScript`.
  if (options.cursor !== false && typeof page.addInitScript === 'function') {
    await installMouseHelper(page, typeof options.cursor === 'object' ? options.cursor : {});
  }

  // Each session can only produce one Recording — we can't run two
  // concurrent capture loops on the same page without their screenshots
  // interfering. Reject loudly rather than letting both quietly drop frames.
  let hasRecorded = false;

  // Timeline capture is "armed" only while `human.record(cb)` is running:
  // a non-null `activeRecordingEvents` means performAction should push each
  // child action into the buffer. The wrapper `record` action itself is
  // skipped — consumers care about what happened inside, not the wrapper.
  let activeRecordingEvents: TimelineEvent[] | null = null;
  let activeRecordingStartMs = 0;
  // Whether `type`/`paste` should record their actual value into the timeline.
  // Armed alongside `activeRecordingEvents` from `record()`'s options.
  let activeRecordingCaptureInputs = false;

  // `recordMeta` is recording-only: it reaches the timeline event but is never
  // passed to plugin hooks, so captured input values don't leak through
  // `params` to every installed plugin.
  async function performAction<T>(
    action: HumanAction,
    actionFn: () => Promise<T>,
    recordMeta?: { readonly inputValue?: string },
  ): Promise<T> {
    for (const plugin of plugins) {
      await plugin.beforeAction?.(action);
    }
    const startedAt = Date.now();
    try {
      const value = await actionFn();
      const durationMs = Date.now() - startedAt;
      const result: ActionResult = { type: action.type, durationMs };
      if (activeRecordingEvents !== null && action.type !== 'record') {
        activeRecordingEvents.push({
          type: action.type,
          params: action.params ?? {},
          tMs: startedAt - activeRecordingStartMs,
          durationMs,
          ...(recordMeta?.inputValue !== undefined ? { inputValue: recordMeta.inputValue } : {}),
        });
      }
      for (const plugin of plugins) {
        await plugin.afterAction?.(action, result);
      }
      return value;
    } catch (error) {
      if (activeRecordingEvents !== null && action.type !== 'record') {
        activeRecordingEvents.push({
          type: action.type,
          params: action.params ?? {},
          tMs: startedAt - activeRecordingStartMs,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
          ...(recordMeta?.inputValue !== undefined ? { inputValue: recordMeta.inputValue } : {}),
        });
      }
      for (const plugin of plugins) {
        await plugin.onError?.(action, error);
      }
      throw error;
    }
  }

  let lastMousePosition: Point = options.initialMousePosition ?? { x: 0, y: 0 };

  // Mouse context factory — every mouse primitive (click, rightClick, hover,
  // drag, plus type's implicit click) reads from the same lastMousePosition
  // closure so successive actions chain off where the cursor actually was.
  const mouseCtx = () => ({
    page,
    personality,
    rng,
    speed,
    getMousePosition: () => lastMousePosition,
    setMousePosition: (point: Point) => {
      lastMousePosition = point;
    },
  });

  // Mouse-target description for timeline/plugin params. Selectors and
  // Locators stringify as-is; raw Points show as `point(x, y)` so the
  // timeline still reads usefully when a drag targets free coordinates.
  const describeMouseTarget = (target: MouseTarget): string => {
    if (typeof target === 'string') return target;
    if ('x' in target && 'y' in target && typeof target.x === 'number') {
      return `point(${target.x}, ${target.y})`;
    }
    return target.toString?.() ?? 'locator';
  };

  const isPointTarget = (target: MouseTarget): target is Point =>
    typeof target !== 'string' && 'x' in target && 'y' in target && typeof target.x === 'number';

  // The value a `type`/`paste` should record into the timeline: the real text
  // when capture is on, `undefined` when it's off OR the target is a password
  // field (masked by omission). Runs only while recording, so the extra
  // attribute read costs nothing in normal use.
  const captureInputValue = async (
    target: MouseTarget,
    value: string,
  ): Promise<string | undefined> => {
    if (activeRecordingEvents === null || !activeRecordingCaptureInputs) return undefined;
    const locator =
      typeof target === 'string' ? page.locator(target) : isPointTarget(target) ? null : target;
    if (locator !== null) {
      try {
        // `type` is case-insensitive in the DOM, so normalize before matching
        // (don't leak a value typed into `<input type="Password">`).
        const fieldType = await locator.first().getAttribute('type', { timeout: 1000 });
        if (fieldType?.toLowerCase() === 'password') {
          return undefined;
        }
      } catch {
        // Element type couldn't be read in time — capture the value anyway.
      }
    }
    return value;
  };

  return {
    personality,
    speed,
    async goto(url) {
      await performAction({ type: 'goto', params: { url } }, async () => {
        await page.goto(url);
      });
    },
    async click(target) {
      const description = describeMouseTarget(target);
      await performAction({ type: 'click', params: { target: description } }, async () => {
        await executeClick(target, mouseCtx());
      });
    },
    async rightClick(target) {
      const description = describeMouseTarget(target);
      await performAction({ type: 'rightClick', params: { target: description } }, async () => {
        await executeClick(target, mouseCtx(), { button: 'right' });
      });
    },
    async doubleClick(target) {
      const description = describeMouseTarget(target);
      await performAction({ type: 'doubleClick', params: { target: description } }, async () => {
        await executeClick(target, mouseCtx(), { clickCount: 2 });
      });
    },
    async hover(target) {
      const description = describeMouseTarget(target);
      await performAction({ type: 'hover', params: { target: description } }, async () => {
        await executeHover(target, mouseCtx());
      });
    },
    async move(target) {
      const description = describeMouseTarget(target);
      await performAction({ type: 'move', params: { target: description } }, async () => {
        await executeMove(target, mouseCtx());
      });
    },
    async drag(from, to) {
      const fromDesc = describeMouseTarget(from);
      const toDesc = describeMouseTarget(to);
      await performAction({ type: 'drag', params: { from: fromDesc, to: toDesc } }, async () => {
        await executeDrag(from, to, mouseCtx());
      });
    },
    async type(target, value) {
      const description = describeMouseTarget(target);
      // `value` itself is intentionally not echoed into params — typed input may
      // be sensitive (passwords, tokens). Expose length only for observability.
      // The actual value reaches the timeline only via `recordMeta` (when
      // captureInputs is on and the field isn't a password) — never params.
      const inputValue = await captureInputValue(target, value);
      await performAction(
        { type: 'type', params: { target: description, length: value.length } },
        async () => {
          // Implicit click before typing: a real user moves the cursor to
          // the input and clicks it; they don't teleport-focus a field. The
          // click is a sub-step of the type action — not its own timeline
          // event (executeClick called directly, bypassing performAction),
          // same pattern as click's built-in hover-before-click motion.
          //
          // Skipped in instant mode (the whole point of which is to bypass
          // humanization) and for empty values (no typing to set up).
          if (speed !== 'instant' && value.length > 0) {
            await executeClick(target, mouseCtx());
          }
          await executeType(target, value, { page, personality, rng, speed });
        },
        inputValue !== undefined ? { inputValue } : undefined,
      );
    },
    async paste(target, value) {
      const description = describeMouseTarget(target);
      // Same privacy posture as `type`: pasted values may be sensitive
      // (passwords, tokens, secrets being pasted from a manager). Expose
      // length only; the real value reaches the timeline via `recordMeta`.
      const inputValue = await captureInputValue(target, value);
      await performAction(
        { type: 'paste', params: { target: description, length: value.length } },
        async () => {
          // Implicit click before pasting — same reasoning as `type`. A real
          // user clicks the field before pasting; they don't teleport-focus.
          // Skipped in instant mode and for empty values.
          if (speed !== 'instant' && value.length > 0) {
            await executeClick(target, mouseCtx());
          }
          await executePaste(target, value, { page, personality, rng, speed });
        },
        inputValue !== undefined ? { inputValue } : undefined,
      );
    },
    async clear(target) {
      await performAction(
        { type: 'clear', params: { target: describeMouseTarget(target) } },
        async () => {
          // Implicit click to focus the field first — same pattern as type/paste
          // (a real user clicks into a field before wiping it). Skipped in
          // instant mode, where executeClear uses native locator.clear().
          if (speed !== 'instant') {
            await executeClick(target, mouseCtx());
          }
          await executeClear(target, { page, personality, rng, speed });
        },
      );
    },
    async check(target) {
      await performAction(
        { type: 'check', params: { target: describeMouseTarget(target) } },
        async () => {
          await executeSetChecked(target, mouseCtx(), true);
        },
      );
    },
    async uncheck(target) {
      await performAction(
        { type: 'uncheck', params: { target: describeMouseTarget(target) } },
        async () => {
          await executeSetChecked(target, mouseCtx(), false);
        },
      );
    },
    async selectOption(target, values) {
      return performAction(
        { type: 'selectOption', params: { target: describeMouseTarget(target), values } },
        () => executeSelectOption(target, values, mouseCtx()),
      );
    },
    async selectText(target, options) {
      const text = options?.text;
      await performAction(
        {
          type: 'selectText',
          params: { target: describeMouseTarget(target), ...(text !== undefined ? { text } : {}) },
        },
        async () => {
          // Move the cursor onto the element first (the visible "select this"
          // approach), then highlight its text. Skipped in instant mode, where
          // the selection is set with no motion.
          if (speed !== 'instant') {
            await executeMove(target, mouseCtx());
          }
          const locator = typeof target === 'string' ? page.locator(target) : target;
          if (text === undefined) {
            await locator.selectText();
            return;
          }
          // Substring select: find the text in the element and select just it,
          // falling back to the whole element when it can't be located.
          const found = await locator.evaluate(selectSubstringInElement, text);
          if (!found) await locator.selectText();
        },
      );
    },
    async upload(target, files) {
      await performAction(
        {
          type: 'upload',
          params: { target: describeMouseTarget(target), files: sanitizeUploadFiles(files) },
        },
        async () => {
          await executeUpload(target, files, mouseCtx());
        },
      );
    },
    async press(key) {
      await performAction({ type: 'press', params: { key } }, async () => {
        await executePress(key, { page, personality, rng, speed });
      });
    },
    async read(target, options) {
      const description = describeReadTarget(target);
      // Same privacy posture as `type`: never echo arbitrary content into
      // action params. `target` description, words (when known up front), and
      // kind are inert metadata; the text itself never lands here.
      return performAction(
        {
          type: 'read',
          params: {
            target: description,
            kind: options?.kind,
          },
        },
        () =>
          executeRead(
            target,
            {
              page,
              personality,
              rng,
              speed,
              // Read shares the session's tracked cursor position so an eye
              // scan starts from where the last click left off, and the next
              // click starts from where the scan ended.
              getMousePosition: () => lastMousePosition,
              setMousePosition: (point) => {
                lastMousePosition = point;
              },
            },
            options,
          ),
      );
    },
    async scroll(target, options) {
      const description = describeScrollTarget(target);
      return performAction(
        {
          type: 'scroll',
          params: { target: description },
        },
        () => executeScroll(target, { page, personality, rng, speed }, options),
      );
    },
    async sleep(ms) {
      // Wrap the core `sleep` in performAction so each pause shows up as a
      // 'sleep' event in the recorded timeline. Without this, `human.record()`
      // exporters (toPlaywright, toHumanJS, ...) would emit replay code that
      // skips the user's intentional pauses entirely.
      await performAction({ type: 'sleep', params: { ms } }, () => sleep(ms));
    },
    async record(
      optionsOrFn: HumanRecordOptions | (() => Promise<void>),
      maybeFn?: () => Promise<void>,
    ): Promise<Recording> {
      const [recordOptions, fn] =
        typeof optionsOrFn === 'function'
          ? [{}, optionsOrFn]
          : [optionsOrFn, maybeFn as () => Promise<void>];

      if (hasRecorded) {
        throw new Error(
          'human.record() can only be called once per session. Create a ' +
            'new browser context (and a new human session) to record a ' +
            'separate clip.',
        );
      }
      hasRecorded = true;

      const captureEnabled = recordOptions.video !== false;
      const captureQuality = recordOptions.quality ?? 'high';

      // Start frame capture before any action runs so the first action's
      // motion is in the recording.
      let captureSession: Awaited<ReturnType<typeof startCapture>> | null = null;
      if (captureEnabled) {
        const { format, quality, fps } = getCaptureSettingsForQuality(captureQuality);
        captureSession = await startCapture(page, { format, quality, fps });
      }

      // Arm the timeline buffer. `performAction` pushes a TimelineEvent for
      // every child action while this is non-null; the wrapper `record` action
      // is filtered out there.
      const events: TimelineEvent[] = [];
      const windowStartMs = Date.now();
      activeRecordingEvents = events;
      activeRecordingStartMs = windowStartMs;
      activeRecordingCaptureInputs = recordOptions.captureInputs !== false;
      let windowEndMs = windowStartMs;

      try {
        await performAction({ type: 'record', params: {} }, async () => {
          try {
            await fn();
          } finally {
            windowEndMs = Date.now();
          }
        });
      } catch (error) {
        // If the callback threw, abort the capture so the temp dir doesn't
        // linger. Then re-throw.
        if (captureSession) await captureSession.abort();
        throw error;
      } finally {
        activeRecordingEvents = null;
        activeRecordingCaptureInputs = false;
      }

      const captureResult = captureSession ? await captureSession.stop() : null;

      return new Recording(captureResult, windowStartMs, windowEndMs, {
        name: recordOptions.name,
        personality: personality.name,
        seed: options.seed === undefined ? null : String(options.seed),
        speed,
        events,
      });
    },

    // ────────────────────────────────────────────────────────────────────
    // Thin re-exports of common Playwright `Page` methods. See the `Human`
    // interface for the rationale; implementations forward unchanged.
    // ────────────────────────────────────────────────────────────────────

    screenshot(opts) {
      return page.screenshot(opts);
    },
    pageText() {
      return page.innerText('body');
    },
    content() {
      return page.content();
    },
    outline(target) {
      const locator =
        target === undefined
          ? page.locator('body')
          : typeof target === 'string'
            ? page.locator(target)
            : target;
      return locator.ariaSnapshot();
    },
    url() {
      return page.url();
    },
    title() {
      return page.title();
    },
    async reload(opts) {
      await performAction({ type: 'reload', params: {} }, async () => {
        await page.reload(opts);
      });
    },
    async goBack(opts) {
      await performAction({ type: 'goBack', params: {} }, async () => {
        await page.goBack(opts);
      });
    },
    async goForward(opts) {
      await performAction({ type: 'goForward', params: {} }, async () => {
        await page.goForward(opts);
      });
    },
    waitForLoadState(state, opts) {
      return page.waitForLoadState(state, opts);
    },
    waitForURL(url, opts) {
      return page.waitForURL(url, opts);
    },
    setViewportSize(size) {
      return page.setViewportSize(size);
    },
    emulateMedia(options) {
      return page.emulateMedia(options);
    },
    pdf(opts) {
      return page.pdf(opts);
    },
  };
}

/**
 * JSON-safe projection of upload files for the timeline / plugin params.
 * Paths pass through; in-memory `{ name, mimeType, buffer }` payloads collapse
 * to their `name` so a Buffer never bloats (or breaks) the serialized timeline.
 */
function sanitizeUploadFiles(files: UploadFiles): string | string[] {
  const one = (f: unknown): string =>
    typeof f === 'string'
      ? f
      : f && typeof f === 'object' && 'name' in f
        ? String((f as { name: unknown }).name)
        : 'file';
  return Array.isArray(files) ? files.map(one) : one(files);
}

/**
 * Human-readable description of a scroll target for action params. Strings
 * (presets + selectors) pass through; objects describe their shape; the
 * Locator branch falls back to `toString()`.
 */
function describeScrollTarget(target: ScrollTarget | undefined): string {
  if (target === undefined) return 'natural';
  if (typeof target === 'string') return target;
  if ('by' in target) return `by:${target.by}`;
  if ('to' in target) return `to:${target.to}`;
  return target.toString?.() ?? 'locator';
}

/**
 * Human-readable description of a read target for action params. Echoes
 * selectors and `{ words }` (both inert); abbreviates literal text to its
 * length so we never expose content even via accidental logging.
 */
function describeReadTarget(target: ReadTarget): string {
  if (typeof target === 'string') return target;
  if ('words' in target && typeof target.words === 'number') return `${target.words} words`;
  if ('text' in target && typeof target.text === 'string') {
    return `text:${target.text.length} chars`;
  }
  return target.toString?.() ?? 'locator';
}
