import { describe, expect, it } from 'vitest';
import { VERSION } from './index';

describe('@humanjs/core', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });
});
