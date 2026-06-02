import { defineConfig } from 'tsup';

export default defineConfig({
  // Object form pins predictable output names: dist/index.* and dist/test.*
  // (the `@humanjs/playwright/test` Playwright-fixture subpath).
  entry: { index: 'src/index.ts', test: 'src/test/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Code splitting extracts the shared library code (createHuman + deps) into a
  // chunk both entries import, instead of inlining a full copy into the `/test`
  // entry. Dedupes both ESM and CJS output — keeps the package tarball lean.
  splitting: true,
});
