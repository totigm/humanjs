# @humanjs/playwright

## 0.1.0

### Minor Changes

- 936e44a: Initial scaffold of `@humanjs/playwright`.

  Exports `createHuman(page, options)` — a factory that wraps a Playwright `Page` with a humanized session bound to a personality, seeded RNG, speed mode, and a plugin pipeline.

  Re-exports the public API of `@humanjs/core` so consumers have a single import surface: `import { createHuman, blend, careful, ... } from '@humanjs/playwright'`.

  Ships one action (`goto`) end-to-end through the plugin pipeline. The wiring is complete and ready for `click`, `type`, `scroll`, and the rest of the v1 primitives to land in subsequent releases.

### Patch Changes

- Updated dependencies [d48f654]
- Updated dependencies [2561c53]
- Updated dependencies [2d76237]
- Updated dependencies [bb74f65]
- Updated dependencies [c4dd128]
  - @humanjs/core@0.1.0
