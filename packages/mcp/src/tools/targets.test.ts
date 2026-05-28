import { describe, expect, it } from 'vitest';
import { resolveTarget } from './targets';

describe('resolveTarget', () => {
  it('returns the selector string when only a selector is given', () => {
    expect(resolveTarget({ selector: '#buy' })).toBe('#buy');
  });

  it('returns a Point when both x and y are given', () => {
    expect(resolveTarget({ x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });

  it('accepts x/y of 0 (falsy but valid)', () => {
    expect(resolveTarget({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('rejects providing both a selector and coordinates', () => {
    expect(() => resolveTarget({ selector: '#x', x: 1, y: 2 })).toThrow(/not both/i);
  });

  it('rejects a half-specified coordinate (x without y)', () => {
    expect(() => resolveTarget({ x: 1 })).toThrow(/both x and y/i);
    expect(() => resolveTarget({ y: 2 })).toThrow(/both x and y/i);
  });

  it('rejects neither a selector nor coordinates', () => {
    expect(() => resolveTarget({})).toThrow(/selector or x\/y/i);
  });
});
