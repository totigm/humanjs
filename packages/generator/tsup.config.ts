import { defineConfig } from 'tsup';

export default defineConfig([
  // The CLI / Node entry. The bin (`humanjs-generator`) needs a shebang so it
  // can be invoked directly via `npx @humanjs/generator <url>`.
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    splitting: false,
    banner: { js: '#!/usr/bin/env node' },
  },
  // The in-page recorder, bundled as a single IIFE the CLI reads at runtime and
  // injects via `addInitScript`. Built browser-side (no Node shims, minified).
  // `clean: false` so it isn't wiped by the entry above (which runs first).
  {
    entry: { injected: 'src/injected/injected-entry.ts' },
    format: ['iife'],
    platform: 'browser',
    dts: false,
    clean: false,
    sourcemap: false,
    treeshake: true,
    minify: true,
    outExtension: () => ({ js: '.js' }),
  },
]);
