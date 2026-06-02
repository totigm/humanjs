import { type Personality, planTypeKeystrokes, type Rng } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import type { Speed } from '../index';
import { computeDwellTime, sleep, speedModeFactor } from '../internal/timing';

/** Runtime dependencies for a humanized keyboard action. */
export interface KeyboardContext {
  readonly page: Page;
  readonly personality: Personality;
  readonly rng: Rng;
  readonly speed: Speed;
}

/** Result of a typing action, returned to the caller for observability. */
export interface TypeResult {
  /** Number of characters in the input string. */
  readonly characters: number;
  /** Number of typos injected (with or without correction). */
  readonly typos: number;
  /** Number of typo corrections via Backspace. */
  readonly corrections: number;
}

/**
 * Executes a humanized typing pass over `value` on `target`.
 *
 * Planning (which keys to press, with what delays, in what order) is delegated
 * to `@humanjs/core`'s `planTypeKeystrokes`. This module is the thin Playwright
 * dispatcher: it focuses the target, walks the plan, and chooses the best
 * Playwright API per key:
 *
 *  - Named keys (`Enter`, `Backspace`, `Tab`) and ASCII chars: `keyboard.press`
 *    — fires keydown/press/up, so handlers (autocomplete, validation) run.
 *  - Non-ASCII characters: `keyboard.insertText` — fires `input` events but
 *    not keyboard events, since `keyboard.press` is keyboard-layout-aware
 *    and can't reliably synthesize characters like `é` or `🎉` on every layout.
 *
 * In `speed: 'instant'`, the whole humanized loop is bypassed in favor of
 * `locator.pressSequentially(value, { delay: 0 })` — events still fire,
 * humanization is skipped.
 */
export async function executeType(
  target: Locator | string,
  value: string,
  ctx: KeyboardContext,
): Promise<TypeResult> {
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;

  if (value.length === 0) {
    return { characters: 0, typos: 0, corrections: 0 };
  }

  if (ctx.speed === 'instant') {
    await locator.pressSequentially(value, { delay: 0 });
    return { characters: value.length, typos: 0, corrections: 0 };
  }

  await locator.focus();

  const plan = planTypeKeystrokes(value, ctx.personality.typing, ctx.rng, {
    personalitySpeed: ctx.personality.speed,
    speedFactor: speedModeFactor(ctx.speed),
  });

  let typos = 0;
  let corrections = 0;

  for (const step of plan) {
    if (step.delayBeforeMs > 0) await sleep(step.delayBeforeMs);
    await dispatchKey(ctx.page, step.key);
    if (step.isTypo) typos++;
    if (step.isCorrection) corrections++;
  }

  return { characters: value.length, typos, corrections };
}

/**
 * Dispatches a single planned key. Multi-char strings are treated as named
 * keys (`Enter`, `Backspace`). Single ASCII chars use the layout-aware
 * `keyboard.press`. Single non-ASCII chars fall back to `insertText` so the
 * adapter works on any keyboard layout, at the cost of skipping per-key events.
 */
async function dispatchKey(page: Page, key: string): Promise<void> {
  if (key.length > 1 || key.charCodeAt(0) < 128) {
    await page.keyboard.press(key);
  } else {
    await page.keyboard.insertText(key);
  }
}

/** Result of a paste action. */
export interface PasteResult {
  /** Length of the pasted value. */
  readonly characters: number;
}

/**
 * Inserts `value` into the target without per-character timing — the Cmd-V
 * semantic. The implicit click before insertion follows the same pattern as
 * `executeType`: a real user clicks the field, then pastes; they don't
 * teleport-focus a field. The click is driven by the caller (`human.paste`
 * in the factory) so this executor is keyboard-only.
 *
 * Uses `page.keyboard.insertText` rather than synthesizing a paste event —
 * the goal is "the value lands in the field instantly," not "fire the page's
 * paste handler." If a user needs paste-event semantics, they can call
 * `human.press('Mod+V')` after setting clipboard contents themselves.
 *
 * In `speed: 'instant'`, behaves identically — paste is already instant by
 * nature; there's nothing to humanize about the timing.
 */
export async function executePaste(
  target: Locator | string,
  value: string,
  ctx: KeyboardContext,
): Promise<PasteResult> {
  if (value.length === 0) return { characters: 0 };
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;
  await locator.focus();
  await ctx.page.keyboard.insertText(value);
  return { characters: value.length };
}

/**
 * Clears a text field the way a person does: select-all, a beat, then delete —
 * a real keyboard gesture, not a programmatic value reset. The implicit click
 * that focuses the field is driven by the caller (`human.clear` in the
 * factory), same pattern as `executeType` / `executePaste`, so this executor
 * is keyboard-only.
 *
 * The select-all chord is platform-aware (`Meta+A` on macOS, `Control+A`
 * elsewhere) via the same resolver `human.press` uses, then `Delete` clears the
 * selection. Works for inputs, textareas, and contenteditable.
 *
 * In `speed: 'instant'`, delegates to Playwright's native `locator.clear()`
 * (focus + actionability + value reset) — no visible gesture, same as the rest
 * of instant mode.
 */
export async function executeClear(target: Locator | string, ctx: KeyboardContext): Promise<void> {
  const locator = typeof target === 'string' ? ctx.page.locator(target) : target;

  if (ctx.speed === 'instant') {
    await locator.clear();
    return;
  }

  await locator.focus();
  // Select all, then delete the selection — the human "wipe the field" gesture.
  await ctx.page.keyboard.press(resolveChord('Mod+A'));
  // A short beat so the selection visibly registers before it's deleted,
  // scaled by personality + speed like the other humanized dwells.
  const beatMs = computeDwellTime(
    ctx.personality.dwell.preClickMs,
    ctx.personality.dwell.preClickJitter,
    ctx.personality,
    ctx.speed,
    ctx.rng,
  );
  if (beatMs > 0) await sleep(beatMs);
  await ctx.page.keyboard.press('Delete');
}

/**
 * Modifier tokens accepted in a `human.press()` chord. `Mod` and `CmdOrCtrl` /
 * `CommandOrControl` are the magic auto-mapping tokens (Meta on Mac,
 * Control elsewhere). The rest are literal — they always resolve to the
 * keycode they name, on every platform.
 *
 * Canonical-case names are listed here for IntelliSense; the runtime
 * parser is case-insensitive, so `'cmd+s'` and `'CMD+S'` work too — they
 * just won't autocomplete.
 */
export type KeyModifier =
  | 'Mod'
  | 'CmdOrCtrl'
  | 'CommandOrControl'
  | 'Cmd'
  | 'Command'
  | 'Meta'
  | 'Win'
  | 'Super'
  | 'Ctrl'
  | 'Control'
  | 'Alt'
  | 'Option'
  | 'Opt'
  | 'Shift';

/**
 * The canonical key names that autocomplete in a `KeyOrChord`. Mirrors
 * Playwright's accepted key vocabulary, plus a few common synonyms.
 * CamelCase names (`ArrowDown`, `PageUp`) are listed in their canonical
 * form — `normalizeKey` preserves case from the input, so what you type is
 * what gets dispatched.
 *
 * Not exhaustive: every other Playwright key (less-common Numpad keys,
 * `BracketLeft`, locale-specific keys, etc.) is outside the typed union
 * and needs a cast at the call site (`'BracketLeft' as KeyOrChord`). The
 * runtime parser handles them — the type just doesn't enumerate them,
 * because adding a `(string & {})` escape hatch would collapse TypeScript's
 * template-literal IntelliSense for the chord autocompletes.
 */
export type KeyName =
  // Letters
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  // Digits
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  // Function keys
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12'
  // Navigation
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End'
  // Editing & control
  | 'Enter'
  | 'Tab'
  | 'Escape'
  | 'Space'
  | 'Backspace'
  | 'Delete'
  | 'Insert'
  // Lock & system keys
  | 'CapsLock'
  | 'NumLock'
  | 'ScrollLock'
  | 'PrintScreen'
  | 'Pause';

/**
 * Strings accepted by `human.press(key)`:
 *
 *  - A bare known key: `'Enter'`, `'F4'`, `'ArrowDown'`, `'S'`, …
 *  - One known modifier + a known key: `'Mod+S'`, `'Shift+ArrowDown'`, …
 *  - Two known modifiers + a known key: `'Mod+Shift+P'`, `'Ctrl+Alt+Tab'`, …
 *
 * Every member of the union is a fully-enumerated literal, which is what
 * makes IDE autocomplete work — type `'Shift+'` and you get every
 * `Shift+<key>` combination as a completion. Adding a `(string & {})`
 * escape hatch anywhere would collapse that down to a single wide
 * template member, killing the completion list.
 *
 * Modifier typos (`'Mosd+S'`) and uncommon-key typos (`'Mod+BraketLeft'`)
 * are both TS errors at the call site — the closed sets on both sides
 * give you compile-time protection that Playwright's plain `string` key
 * type can't.
 *
 * **Escape hatch for uncommon keys.** Less-common Playwright keys
 * (`'BracketLeft'`, `'NumpadAdd'`, locale-specific keys, …) and 3+
 * modifier chords (`'Ctrl+Shift+Alt+K'`) aren't in the union and need a
 * cast at the call site:
 *
 * ```ts
 * await human.press('Mod+BracketLeft' as KeyOrChord);
 * await human.press('Ctrl+Shift+Alt+K' as KeyOrChord);
 * ```
 *
 * The runtime parser handles these fine — the cast just acknowledges
 * "I'm using a key outside the autocomplete vocabulary." If you find
 * yourself casting often for a specific key, propose adding it to
 * `KeyName` in a PR.
 *
 * Lowercase modifiers (`'mod+s'`) also don't typecheck even though the
 * runtime accepts them — TS-strict steers users toward the canonical
 * casing, which keeps key strings consistent across a codebase.
 */
export type KeyOrChord =
  | KeyName
  | `${KeyModifier}+${KeyName}`
  | `${KeyModifier}+${KeyModifier}+${KeyName}`;

/** Result of a `press` action. */
export interface PressResult {
  /** The exact chord that was dispatched (after Mod-resolution). */
  readonly dispatched: string;
}

/**
 * Dispatches a single key or keyboard chord — `'Tab'`, `'Enter'`, `'Mod+S'`,
 * `'Cmd+Shift+P'`, `'Ctrl+C'`, …
 *
 * Parses the input into zero-or-more modifiers + a final key, normalizes
 * aliases, then dispatches via `page.keyboard.press()` which uses
 * Playwright's standard `Modifier+Key` syntax (or just `Key` for bare keys).
 *
 * Modifier rules:
 *
 *  - `Mod` / `CmdOrCtrl` / `CommandOrControl` → magic: becomes `Meta` on
 *    macOS, `Control` elsewhere. The right token for cross-platform app
 *    shortcuts. All three are aliases; `Mod` is shortest, the others come
 *    from the Electron / Mousetrap convention.
 *  - `Cmd` / `Command` / `Meta` / `Win` / `Super` → literal `Meta` keycode.
 *    Same physical key on every OS (Command on Mac, Windows key on Windows,
 *    Super on Linux). Note: this does NOT auto-translate to Control.
 *  - `Ctrl` / `Control` → literal Control. Stays Control on every OS, so
 *    Mac-specific things like terminal Ctrl+C still work.
 *  - `Alt` / `Option` / `Opt` → literal Alt.
 *  - `Shift` → literal Shift.
 *
 * Modifier names and key names are case-insensitive.
 *
 * @example
 * ```ts
 * await human.press('Tab');                // bare key
 * await human.press('Enter');              // bare key
 * await human.press('Mod+S');              // cross-platform save
 * await human.press('Cmd+Shift+P');        // literal Meta+Shift+P
 * await human.press('Control+C');          // literal Ctrl+C
 * ```
 */
export async function executePress(key: KeyOrChord, ctx: KeyboardContext): Promise<PressResult> {
  const dispatched = resolveChord(key);
  await ctx.page.keyboard.press(dispatched);
  return { dispatched };
}

/**
 * Parses the user-facing key string and resolves it to Playwright's
 * canonical `Modifier+...+Key` form (or just `Key` for bare keys), with
 * `Mod` mapped per platform and aliases normalized.
 *
 * Exported for the test suite — not part of the public API.
 */
export function resolveChord(key: KeyOrChord): string {
  // Narrow to plain string for the parser — `KeyOrChord` is a wide template
  // literal union and TS can't always infer the callbacks' parameter type
  // from `.split()` when the input is the full union shape.
  const parts = (key as string)
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error(`Invalid key: ${JSON.stringify(key)} — empty or only separators`);
  }

  const keyToken = parts[parts.length - 1];
  if (keyToken === undefined) {
    throw new Error(`Invalid key: ${JSON.stringify(key)} — missing key`);
  }
  const modifierTokens = parts.slice(0, -1);

  const modifiers: string[] = [];
  for (const token of modifierTokens) {
    const resolved = resolveModifier(token);
    if (resolved === null) {
      throw new Error(
        `Invalid key modifier: ${JSON.stringify(token)} in ${JSON.stringify(key)}. ` +
          `Use one of: Mod/CmdOrCtrl/CommandOrControl, Cmd/Command/Meta/Win/Super, Ctrl/Control, Alt/Option/Opt, Shift.`,
      );
    }
    modifiers.push(resolved);
  }

  return [...modifiers, normalizeKey(keyToken)].join('+');
}

/**
 * Normalizes a modifier alias to Playwright's canonical name. Returns `null`
 * if the input isn't a known modifier — the caller then throws with a useful
 * message instead of letting Playwright fail with a cryptic error downstream.
 */
function resolveModifier(token: string): string | null {
  const lower = token.toLowerCase();
  switch (lower) {
    case 'mod':
    case 'cmdorctrl':
    case 'commandorcontrol':
      return isMac() ? 'Meta' : 'Control';
    case 'cmd':
    case 'command':
    case 'meta':
    case 'win':
    case 'super':
      return 'Meta';
    case 'ctrl':
    case 'control':
      return 'Control';
    case 'alt':
    case 'option':
    case 'opt':
      return 'Alt';
    case 'shift':
      return 'Shift';
    default:
      return null;
  }
}

/**
 * Normalizes the final key in a chord. Single-letter keys are upper-cased
 * (Playwright expects `'S'`, not `'s'`, for the `S` key in chord form).
 * Multi-character keys get their first letter upper-cased but **keep the
 * rest of their case** — Playwright's canonical key names are CamelCase
 * (`ArrowDown`, `PageUp`, `KeyA`, `BracketLeft`, `NumpadAdd`), and
 * lowercasing the tail would mangle them into `Arrowdown` / `Pageup` /
 * etc., which Playwright doesn't recognize.
 *
 * Single-word keys (`Tab`, `Enter`, `Escape`) still title-case correctly
 * with this rule: their tail is already lowercase, so preserving it is
 * the same as lowercasing it.
 */
function normalizeKey(key: string): string {
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Platform detection for the `Mod` token. Node-only check; runs at chord-
 * resolution time (not at module load) so tests that need to simulate a
 * different platform can stub `process.platform` first.
 */
function isMac(): boolean {
  return process.platform === 'darwin';
}
