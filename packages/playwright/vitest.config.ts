import { defaultExclude, defineConfig } from 'vitest/config';

/**
 * Default test config — runs the fast mocked unit tests.
 *
 * Integration tests (`*.integration.test.ts`) launch a real chromium and
 * take seconds per test. They live in the same `src/` tree but are
 * excluded from the default run; use `pnpm test:integration` (which loads
 * `vitest.integration.config.ts`) to run them.
 */
export default defineConfig({
  test: {
    exclude: [...defaultExclude, '**/*.integration.test.ts'],
  },
});
