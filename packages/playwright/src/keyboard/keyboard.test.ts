import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type KeyOrChord, resolveChord } from './index';

// Many tests below pass deliberately type-invalid strings to verify the
// parser's runtime robustness — lowercase modifiers, whitespace tokens,
// empty strings, unknown modifiers like `'Hyper+S'`. The `KeyOrChord` type
// (rightly) rejects these at compile time, so we cast to bypass the type
// check and exercise the runtime path. Production code should NOT do this;
// it's a test-only escape.
const asChord = (s: string): KeyOrChord => s as KeyOrChord;

/**
 * Unit tests for `resolveChord` — the parser that powers `human.press()`.
 * Pure function, no Playwright needed. (Function name is historical — it
 * resolves any key string, bare or chord; a bare key is just a chord with
 * zero modifiers.)
 *
 * Platform-dependent tests stub `process.platform` because the `Mod` token
 * maps based on it. The original value is restored after each test so other
 * suites aren't affected.
 */

describe('resolveChord', () => {
  const originalPlatform = process.platform;

  // Stubs process.platform for a single test, then restores it. Uses
  // Object.defineProperty because `process.platform` is read-only.
  function setPlatform(p: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', { value: p, configurable: true });
  }

  beforeEach(() => {
    setPlatform(originalPlatform);
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  describe('plain key (no modifier)', () => {
    it('returns single-letter keys upper-cased', () => {
      // Lowercase 's' isn't a valid `KeyOrChord` literal (canonical is 'S'),
      // but the runtime parser still upper-cases it — so we cast for the
      // test. Real callers should write 'S'.
      expect(resolveChord(asChord('s'))).toBe('S');
      expect(resolveChord('S')).toBe('S');
    });

    it('returns named keys title-cased', () => {
      expect(resolveChord('Enter')).toBe('Enter');
      expect(resolveChord(asChord('enter'))).toBe('Enter');
      // ALL-CAPS doesn't round-trip cleanly — the tail stays uppercase —
      // but the more important behavior is that mixed-case CamelCase keys
      // survive (see the next test).
      expect(resolveChord(asChord('ENTER'))).toBe('ENTER');
    });

    it('preserves CamelCase in multi-character key names', () => {
      // Playwright's canonical key names are CamelCase: 'ArrowDown',
      // 'PageUp', 'KeyA', 'BracketLeft', 'NumpadAdd'. Lowercasing the
      // tail would mangle these into 'Arrowdown' / 'Pageup' / etc., which
      // Playwright doesn't accept. This was a real bug surfaced in branch
      // review — Mod+ArrowDown was silently turning into Control+Arrowdown.
      expect(resolveChord('ArrowDown')).toBe('ArrowDown');
      expect(resolveChord('ArrowUp')).toBe('ArrowUp');
      expect(resolveChord('PageDown')).toBe('PageDown');
      expect(resolveChord('PageUp')).toBe('PageUp');
      // `'BracketLeft'` as a bare key isn't in the `KeyName` union (it's
      // a key you'd use with a modifier, e.g. `'Mod+BracketLeft'` for "go
      // back"). The runtime parser still handles it; we cast to test that
      // path explicitly.
      expect(resolveChord(asChord('BracketLeft'))).toBe('BracketLeft');
    });

    it('preserves CamelCase inside a chord with a modifier', () => {
      setPlatform('darwin');
      expect(resolveChord('Mod+ArrowDown')).toBe('Meta+ArrowDown');
      setPlatform('linux');
      expect(resolveChord('Mod+ArrowDown')).toBe('Control+ArrowDown');
      expect(resolveChord('Shift+PageUp')).toBe('Shift+PageUp');
    });
  });

  describe('Mod (cross-platform magic token)', () => {
    it('maps to Meta on macOS', () => {
      setPlatform('darwin');
      expect(resolveChord('Mod+S')).toBe('Meta+S');
    });

    it('maps to Control on Windows', () => {
      setPlatform('win32');
      expect(resolveChord('Mod+S')).toBe('Control+S');
    });

    it('maps to Control on Linux', () => {
      setPlatform('linux');
      expect(resolveChord('Mod+S')).toBe('Control+S');
    });

    it('CmdOrCtrl behaves identically to Mod', () => {
      setPlatform('darwin');
      expect(resolveChord('CmdOrCtrl+S')).toBe('Meta+S');
      setPlatform('linux');
      expect(resolveChord('CmdOrCtrl+S')).toBe('Control+S');
    });
  });

  describe('literal Meta aliases', () => {
    it('Cmd, Command, Meta, Win, Super all resolve to Meta', () => {
      // Test on Windows to prove these do NOT auto-translate to Control —
      // they're literal Meta keycodes (= Win key on Windows).
      setPlatform('win32');
      expect(resolveChord('Cmd+S')).toBe('Meta+S');
      expect(resolveChord('Command+S')).toBe('Meta+S');
      expect(resolveChord('Meta+S')).toBe('Meta+S');
      expect(resolveChord('Win+S')).toBe('Meta+S');
      expect(resolveChord('Super+S')).toBe('Meta+S');
    });
  });

  describe('literal Control', () => {
    it('Ctrl and Control resolve to Control on every platform', () => {
      setPlatform('darwin');
      expect(resolveChord('Ctrl+C')).toBe('Control+C');
      expect(resolveChord('Control+C')).toBe('Control+C');
      setPlatform('win32');
      expect(resolveChord('Ctrl+C')).toBe('Control+C');
    });
  });

  describe('Alt aliases', () => {
    it('Alt, Option, Opt all resolve to Alt', () => {
      expect(resolveChord('Alt+F4')).toBe('Alt+F4');
      expect(resolveChord('Option+F4')).toBe('Alt+F4');
      expect(resolveChord('Opt+F4')).toBe('Alt+F4');
    });
  });

  describe('case insensitivity', () => {
    it('modifier names are case-insensitive at runtime (canonical case in types)', () => {
      // The `KeyOrChord` type only lists canonical-case modifiers ('Mod',
      // 'Cmd', 'Ctrl', etc.), so lowercase/uppercase variants are TS errors
      // — but the parser handles them. Casting here verifies the runtime
      // forgiveness; production code should write canonical case.
      setPlatform('darwin');
      expect(resolveChord(asChord('mod+s'))).toBe('Meta+S');
      expect(resolveChord(asChord('MOD+S'))).toBe('Meta+S');
      expect(resolveChord(asChord('Mod+s'))).toBe('Meta+S');
    });

    it('single-letter keys are case-insensitive (always uppercased)', () => {
      expect(resolveChord(asChord('Shift+a'))).toBe('Shift+A');
      expect(resolveChord('Shift+A')).toBe('Shift+A');
    });
  });

  describe('multi-modifier chords', () => {
    it('preserves modifier order from input', () => {
      setPlatform('darwin');
      expect(resolveChord('Mod+Shift+P')).toBe('Meta+Shift+P');
      // Order matters in Playwright's chord syntax — the parser doesn't
      // sort, it just normalizes each token.
      expect(resolveChord('Shift+Mod+P')).toBe('Shift+Meta+P');
    });

    it('supports three-modifier chords', () => {
      setPlatform('darwin');
      expect(resolveChord('Mod+Shift+Alt+K')).toBe('Meta+Shift+Alt+K');
    });
  });

  describe('error paths', () => {
    it('throws on an empty chord', () => {
      // Empty strings + separator-only strings aren't valid `KeyOrChord`
      // literals, so we cast to exercise the runtime guards.
      expect(() => resolveChord(asChord(''))).toThrow(/empty or only separators/);
      expect(() => resolveChord(asChord('+++'))).toThrow(/empty or only separators/);
    });

    it('throws on an unknown modifier with a useful message', () => {
      // 'Hyper+S' isn't a valid Shortcut (Hyper isn't a KeyModifier),
      // so TS rejects it — that's actually the FIRST line of defense.
      // Casting tests the runtime fallback for inputs that slip through
      // (e.g. user-supplied strings from config).
      expect(() => resolveChord(asChord('Hyper+S'))).toThrow(/Invalid key modifier.*"Hyper"/);
    });

    it('error message lists valid modifiers so users can self-correct', () => {
      // The error message is the discovery surface — without it, "what
      // modifiers are accepted?" requires reading the source.
      expect(() => resolveChord(asChord('Bogus+S'))).toThrow(
        /Mod, CmdOrCtrl, Cmd\/Command\/Meta\/Win\/Super, Ctrl\/Control, Alt\/Option\/Opt, Shift/,
      );
    });
  });

  describe('whitespace tolerance', () => {
    it('trims tokens so "Mod + S" works the same as "Mod+S"', () => {
      // Whitespace-padded chords aren't valid `KeyOrChord` literals (the type
      // expects exact 'Mod+S' form), but the runtime parser trims tokens —
      // useful for config files or user input. Casting to exercise that path.
      setPlatform('darwin');
      expect(resolveChord(asChord('Mod + S'))).toBe('Meta+S');
      expect(resolveChord(asChord(' Mod+S '))).toBe('Meta+S');
    });
  });
});
