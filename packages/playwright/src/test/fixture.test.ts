import { describe, it, expect as vitestExpect } from 'vitest';
import { expect, test } from './index';

// The fixture's runtime behavior (seed = title, CI = instant) is exercised by
// Playwright Test itself, not vitest — these checks confirm the module wires up
// and re-exports a usable `test` (with the `human` fixture extended on) and
// `expect`, which is what would break if the subpath build or imports regress.
describe('@humanjs/playwright/test', () => {
  it('re-exports a Playwright test extended with fixtures', () => {
    vitestExpect(typeof test).toBe('function');
    vitestExpect(typeof test.extend).toBe('function');
    vitestExpect(typeof test.use).toBe('function');
  });

  it('re-exports expect', () => {
    vitestExpect(typeof expect).toBe('function');
  });
});
