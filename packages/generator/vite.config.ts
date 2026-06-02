import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds the dashboard SPA from `dashboard/` into `dist/dashboard/`, which the
// CLI's local server serves (falling back to the embedded placeholder when the
// build is absent). Relative `base` so assets load from whatever loopback port
// the server picks at runtime.
export default defineConfig({
  root: 'dashboard',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist/dashboard',
    emptyOutDir: true,
  },
});
