import { defineConfig } from 'tsup';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  // The bin entry needs a shebang so `humanjs` is directly executable.
  banner: { js: '#!/usr/bin/env node' },
  // Bake the real version in at build time. Reading package.json at
  // runtime would mean resolving a path out of dist/, which differs
  // between the ESM and CJS outputs; a CLI that misreports its own
  // version is a support ticket waiting to happen.
  define: { __CLI_VERSION__: JSON.stringify(pkg.version) },
});
