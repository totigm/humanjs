import { describe, expect, it } from 'vitest';
import type { CliOptions } from './args';
import { buildMediaSettings, describeMedia } from './media';

const base: CliOptions = { headless: true, viewport: { width: 800, height: 600 } };

describe('buildMediaSettings', () => {
  it('returns null when nothing was asked for', () => {
    // Callers skip the emulateMedia call entirely rather than resetting
    // emulation the browser was never doing.
    expect(buildMediaSettings(base)).toBeNull();
  });

  it('maps --reduced-motion to the reduce value Playwright expects', () => {
    expect(buildMediaSettings({ ...base, reducedMotion: true })).toEqual({
      reducedMotion: 'reduce',
    });
  });

  it('passes the colour scheme through', () => {
    expect(buildMediaSettings({ ...base, colorScheme: 'dark' })).toEqual({ colorScheme: 'dark' });
  });

  it('maps --forced-colors to active', () => {
    expect(buildMediaSettings({ ...base, forcedColors: true })).toEqual({ forcedColors: 'active' });
  });

  it('combines every requested feature in one payload', () => {
    expect(
      buildMediaSettings({ ...base, reducedMotion: true, colorScheme: 'dark', forcedColors: true }),
    ).toEqual({ reducedMotion: 'reduce', colorScheme: 'dark', forcedColors: 'active' });
  });
});

describe('describeMedia', () => {
  it('says nothing when nothing is emulated', () => {
    expect(describeMedia(null)).toBeNull();
  });

  it('names the CSS features, not the flag names', () => {
    // The run log should be greppable against the stylesheet it is testing.
    expect(describeMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })).toBe(
      'prefers-reduced-motion: reduce, prefers-color-scheme: dark',
    );
  });
});
