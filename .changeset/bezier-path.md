---
'@humanjs/core': minor
'@humanjs/playwright': patch
---

Add `bezierPath()` for humanized mouse trajectories.

Produces cubic-Bezier paths with control points offset perpendicular to the start→end line, scaled by `Personality.mouse.curvature`. Deterministic given a seeded `Rng` — same seed produces identical coordinates on every run and every platform.

The function lives in `@humanjs/core` so future adapters (`@humanjs/puppeteer`, etc.) can reuse it without duplication. `@humanjs/playwright` re-exports it for convenience: `import { bezierPath } from '@humanjs/playwright'`.

Math adapted from [ghost-cursor](https://github.com/Xetera/ghost-cursor) (MIT, © 2020 Xetera). See `THIRD_PARTY_NOTICES.md` at the repo root for full attribution. Coming next: velocity profiling, micro-jitter, and the `click()` action that consumes this.
