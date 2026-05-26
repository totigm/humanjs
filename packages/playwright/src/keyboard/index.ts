import { type Personality, planTypeKeystrokes, type Rng } from '@humanjs/core';
import type { Locator, Page } from 'playwright';
import type { Speed } from '../index';
import { sleep, speedModeFactor } from '../internal/timing';

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
 * `human.shortcut('Mod+V')` after setting clipboard contents themselves.
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
 * Modifier tokens accepted in a shortcut chord. `Mod` and `CmdOrCtrl` /
 * `CommandOrControl` are the magic auto-mapping tokens (Meta on Mac,
 * Control elsewhere). The rest are literal — they always resolve to the
 * keycode they name, on every platform.
 *
 * Canonical-case names are listed here for IntelliSense; the runtime
 * parser is case-insensitive, so `'cmd+s'` and `'CMD+S'` work too — they
 * just won't autocomplete.
 */
export type ShortcutModifier =
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
 * The canonical key names a `Shortcut` can end with. Mirrors Playwright's
 * accepted key vocabulary, plus a few common synonyms. CamelCase names
 * (`ArrowDown`, `PageUp`) are listed in their canonical form — `normalizeKey`
 * preserves case from the input, so what you type is what gets dispatched.
 *
 * Not exhaustive: every other Playwright key (less-common Numpad keys,
 * `BracketLeft`, locale-specific keys, etc.) still works via the
 * `(string & {})` escape hatch on the `Shortcut` type below. They just
 * don't autocomplete in IDEs.
 */
export type ShortcutKey =
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
 * Strings accepted by `human.shortcut(chord)`:
 *
 *  - A bare known key: `'Enter'`, `'F4'`, `'ArrowDown'`, `'S'`
 *  - One known modifier + any key: `'Mod+S'`, `'Mod+BracketLeft'`, …
 *  - Two known modifiers + any key: `'Mod+Shift+P'`, `'Ctrl+Alt+Delete'`, …
 *
 * The escape hatch lives on the **key portion only**, not on the whole
 * chord — so modifier typos get caught at compile time (`'Mosd+S'` is a
 * TS error) while less-common keys (`'BracketLeft'`, `'NumpadAdd'`,
 * locale-specific keys) still typecheck under a known modifier.
 *
 * 3+ modifier chords (`'Ctrl+Shift+Alt+X'`) typecheck through the same
 * key-side escape hatch — TS sees two modifiers + `'Alt+X'` as the "key,"
 * the runtime parser handles three modifiers + `X` correctly. The cap at
 * two literal modifiers is a TypeScript size-of-union constraint, not a
 * runtime limit.
 *
 * Bare uncommon keys (`'BracketLeft'` alone, no modifier) DON'T typecheck
 * — that route would slip past the modifier guard. Workarounds: use a
 * modifier, or `'BracketLeft' as Shortcut`. The case is vanishingly rare
 * in real shortcut bindings.
 *
 * Lowercase modifiers (`'mod+s'`) also DON'T typecheck even though the
 * runtime accepts them — TS-strict steers users toward the canonical
 * casing, which keeps shortcut strings consistent across a codebase.
 */
export type Shortcut =
  | ShortcutKey
  | `${ShortcutModifier}+${ShortcutKey | (string & {})}`
  | `${ShortcutModifier}+${ShortcutModifier}+${ShortcutKey | (string & {})}`;

/** Result of a shortcut action. */
export interface ShortcutResult {
  /** The exact chord that was dispatched (after Mod-resolution). */
  readonly dispatched: string;
}

/**
 * Dispatches a keyboard chord like `'Mod+S'`, `'Cmd+Shift+P'`, `'Ctrl+C'`.
 *
 * Parses the chord into modifiers + a final key, normalizes aliases, then
 * dispatches via `page.keyboard.press()` which uses Playwright's standard
 * `Modifier+Key` syntax.
 *
 * Modifier rules:
 *
 *  - `Mod` / `CmdOrCtrl` → magic: becomes `Meta` on macOS, `Control` elsewhere.
 *    The right token for cross-platform app shortcuts.
 *  - `Cmd` / `Command` / `Meta` / `Win` / `Super` → literal `Meta` keycode.
 *    Same physical key on every OS (Command on Mac, Windows key on Windows,
 *    Super on Linux). Note: this does NOT auto-translate to Control.
 *  - `Ctrl` / `Control` → literal Control. Stays Control on every OS, so
 *    Mac-specific things like terminal Ctrl+C still work.
 *  - `Alt` / `Option` / `Opt` → literal Alt.
 *  - `Shift` → literal Shift.
 *
 * Modifier names and key names are case-insensitive. The final key in the
 * chord is the only non-modifier — at least one is required.
 *
 * @example
 * ```ts
 * await human.shortcut('Mod+S');             // cross-platform save
 * await human.shortcut('Cmd+Shift+P');       // literal Meta+Shift+P
 * await human.shortcut('Control+C');         // literal Ctrl+C
 * await human.shortcut('Enter');             // just the key
 * ```
 */
export async function executeShortcut(
  chord: Shortcut,
  ctx: KeyboardContext,
): Promise<ShortcutResult> {
  const dispatched = resolveChord(chord);
  await ctx.page.keyboard.press(dispatched);
  return { dispatched };
}

/**
 * Parses the user-facing chord string and resolves it to Playwright's
 * canonical `Modifier+Modifier+Key` form, with `Mod` mapped per platform
 * and aliases normalized.
 *
 * Exported for the test suite — not part of the public API.
 */
export function resolveChord(chord: Shortcut): string {
  // Narrow to plain string for the parser — `Shortcut` is a wide template
  // literal union and TS can't always infer the callbacks' parameter type
  // from `.split()` when the input is the full union shape.
  const parts = (chord as string)
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new Error(`Invalid shortcut chord: ${JSON.stringify(chord)} — empty or only separators`);
  }

  const keyToken = parts[parts.length - 1];
  if (keyToken === undefined) {
    throw new Error(`Invalid shortcut chord: ${JSON.stringify(chord)} — missing key`);
  }
  const modifierTokens = parts.slice(0, -1);

  const modifiers: string[] = [];
  for (const token of modifierTokens) {
    const resolved = resolveModifier(token);
    if (resolved === null) {
      throw new Error(
        `Invalid shortcut modifier: ${JSON.stringify(token)} in chord ${JSON.stringify(chord)}. ` +
          `Use one of: Mod, CmdOrCtrl, Cmd/Command/Meta/Win/Super, Ctrl/Control, Alt/Option/Opt, Shift.`,
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
