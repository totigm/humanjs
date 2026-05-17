---
'@humanjs/playwright': minor
---

Initial scaffold of `@humanjs/playwright`.

Exports `createHuman(page, options)` — a factory that wraps a Playwright `Page` with a humanized session bound to a personality, seeded RNG, speed mode, and a plugin pipeline.

Re-exports the public API of `@humanjs/core` so consumers have a single import surface: `import { createHuman, blend, careful, ... } from '@humanjs/playwright'`.

Ships one action (`goto`) end-to-end through the plugin pipeline. The wiring is complete and ready for `click`, `type`, `scroll`, and the rest of the v1 primitives to land in subsequent releases.
