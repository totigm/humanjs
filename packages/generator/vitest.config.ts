import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (which sets `root: 'dashboard'` for the SPA
// build) so vitest runs from the package root and finds the src tests rather
// than scanning the dashboard app.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
