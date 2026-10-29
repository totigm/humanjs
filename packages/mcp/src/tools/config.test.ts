import { describe, expect, it } from 'vitest';
import { toMediaValue } from './config';

describe('toMediaValue', () => {
  it("translates 'system' to the null Playwright resets with", () => {
    expect(toMediaValue('system')).toBeNull();
  });

  it('passes a real value through untouched', () => {
    expect(toMediaValue('reduce')).toBe('reduce');
    expect(toMediaValue('dark')).toBe('dark');
    expect(toMediaValue('no-preference')).toBe('no-preference');
  });

  it('keeps undefined as undefined rather than collapsing it to null', () => {
    // Playwright leaves a feature alone on undefined and *resets* it on
    // null. Collapsing the two would make setting the colour scheme
    // silently cancel a reduced-motion emulation set earlier.
    expect(toMediaValue(undefined)).toBeUndefined();
  });
});
