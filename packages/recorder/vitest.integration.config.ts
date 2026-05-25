import { defineConfig } from 'vitest/config';

/**
 * Integration test config — runs only the `*.integration.test.ts` files
 * that launch a real browser. Loaded via `pnpm test:integration`.
 */
export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
  },
});
