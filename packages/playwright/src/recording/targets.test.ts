import { describe, expect, it } from 'vitest';
import { parsePointTarget, resolveMouseTarget } from './targets';

describe('parsePointTarget', () => {
  it('parses point(x, y) into a Point, including negatives and decimals', () => {
    expect(parsePointTarget('point(120, 340)')).toEqual({ x: 120, y: 340 });
    expect(parsePointTarget('point(-5.5,10)')).toEqual({ x: -5.5, y: 10 });
  });

  it('returns null for selectors and empty input', () => {
    expect(parsePointTarget('#id')).toBeNull();
    expect(parsePointTarget('role=button[name="Go"]')).toBeNull();
    expect(parsePointTarget(undefined)).toBeNull();
  });
});

describe('resolveMouseTarget', () => {
  it('returns a Point for raw coordinates and the string for selectors', () => {
    expect(resolveMouseTarget('point(1, 2)')).toEqual({ x: 1, y: 2 });
    expect(resolveMouseTarget('#id')).toBe('#id');
    expect(resolveMouseTarget(null)).toBe('');
  });
});
