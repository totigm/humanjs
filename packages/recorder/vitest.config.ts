import { defaultExclude, defineConfig } from 'vitest/config';

/**
 * Default test config — fast unit tests only. The recorder package
 * currently only has integration tests (which need a real browser);
 * they live in `*.integration.test.ts` files and run via
 * `pnpm test:integration` (see `vitest.integration.config.ts`).
 */
export default defineConfig({
  test: {
    exclude: [...defaultExclude, '**/*.integration.test.ts'],
  },
});
