import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  // `@clack/prompts` is ESM-only, so leaving it external would break the CJS
  // build's `require()`. Bundle it into both outputs instead — the installer
  // is self-contained and ships no runtime dependencies.
  noExternal: ['@clack/prompts'],
  // The bin entry (`humanjs-skill`) needs a shebang so `npx @humanjs/skill`
  // can execute it directly.
  banner: { js: '#!/usr/bin/env node' },
});
