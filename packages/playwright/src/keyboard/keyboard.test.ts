import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveChord } from './index';

/**
 * Unit tests for `resolveChord` — the chord parser that powers
 * `human.shortcut()`. Pure function, no Playwright needed.
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
      expect(resolveChord('s')).toBe('S');
      expect(resolveChord('S')).toBe('S');
    });

    it('returns named keys title-cased', () => {
      expect(resolveChord('Enter')).toBe('Enter');
      expect(resolveChord('enter')).toBe('Enter');
      expect(resolveChord('ENTER')).toBe('Enter');
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
    it('modifier names are case-insensitive', () => {
      setPlatform('darwin');
      expect(resolveChord('mod+s')).toBe('Meta+S');
      expect(resolveChord('MOD+S')).toBe('Meta+S');
      expect(resolveChord('Mod+s')).toBe('Meta+S');
    });

    it('single-letter keys are case-insensitive (always uppercased)', () => {
      expect(resolveChord('Shift+a')).toBe('Shift+A');
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
      expect(() => resolveChord('')).toThrow(/empty or only separators/);
      expect(() => resolveChord('+++')).toThrow(/empty or only separators/);
    });

    it('throws on an unknown modifier with a useful message', () => {
      expect(() => resolveChord('Hyper+S')).toThrow(/Invalid shortcut modifier.*"Hyper"/);
    });

    it('error message lists valid modifiers so users can self-correct', () => {
      // The error message is the discovery surface — without it, "what
      // modifiers are accepted?" requires reading the source.
      expect(() => resolveChord('Bogus+S')).toThrow(
        /Mod, CmdOrCtrl, Cmd\/Command\/Meta\/Win\/Super, Ctrl\/Control, Alt\/Option\/Opt, Shift/,
      );
    });
  });

  describe('whitespace tolerance', () => {
    it('trims tokens so "Mod + S" works the same as "Mod+S"', () => {
      setPlatform('darwin');
      expect(resolveChord('Mod + S')).toBe('Meta+S');
      expect(resolveChord(' Mod+S ')).toBe('Meta+S');
    });
  });
});
