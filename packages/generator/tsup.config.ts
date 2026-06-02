import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  // The bin entry (`humanjs-generator`) needs a shebang so it can be invoked
  // directly via `npx @humanjs/generator <url>`. tsup prepends this to the
  // entry output without affecting the importable surface.
  banner: { js: '#!/usr/bin/env node' },
});
