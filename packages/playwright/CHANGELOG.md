# @humanjs/playwright

## 0.2.0

### Minor Changes

- cce64bf: Add `human.click(target)` — the first real humanized action.

  Resolves a selector string or `Locator`, picks a Gaussian-distributed point inside the target's bounding box, generates a Bezier path from the current mouse position to it, applies the `humanizePath` post-processor for bell-curve velocity and sub-pixel jitter, walks the mouse along the path with timing scaled by `Personality.mouse.travelTimeMs` and the session's `speed` mode, then clicks.

  `speed: 'instant'` bypasses all humanization and uses Playwright's native `locator.click()`.

  Click actions flow through the plugin pipeline as `{ type: 'click', params: { target } }`, with `onError` notified before the error re-throws.

  Coming next on this branch: hover-before-click micro-pause and the `overshoot` + `misclick` realism layers.

- cce64bf: Wire up `Personality.dwell.preClickMs` and `Personality.dwell.postActionMs` in `human.click()`.

  After the mouse settles on the target — before the click — a humanized session now pauses for `preClickMs` (with `preClickJitter` randomization). After the click resolves, it pauses again for `postActionMs`. Both dwells are scaled by `Personality.speed` and the global speed mode; `speed: 'instant'` skips both.

  This closes the gap the API doc comment hinted at:

  ```ts
  await human.click(selector); // hover, micro-move, click
  //       ↑ now actually happens
  ```

  Different personalities feel measurably different now: `careful` settles for ~120ms before clicking, `distracted` for ~200ms, `precise` for ~80ms. None of those involved code changes — they were already in the preset definitions, just unused until this PR.

- cce64bf: Refinements to `human.click()` from branch review:

  - **New**: `CreateHumanOptions.initialMousePosition` — set the starting cursor position when you've already moved the cursor before creating the session. Defaults to `{ x: 0, y: 0 }`.
  - **Fix**: In `speed: 'instant'`, the bounding box is now read before the click. Previously, if the click navigated away or unmounted the element, the post-click `boundingBox()` would return `null` and the recorded position fell back to the stale `lastMousePosition`.
  - **Fix**: Mouse position commits before the click side-effect. Consecutive clicks now stay continuous even if a click throws (page closed, target removed mid-flight) — previously the next click's path would start from the previous position instead of the failed target.

### Patch Changes

- cce64bf: Add `bezierPath()` for humanized mouse trajectories.

  Produces cubic-Bezier paths with control points offset perpendicular to the start→end line, scaled by `Personality.mouse.curvature`. Deterministic given a seeded `Rng` — same seed produces identical coordinates on every run and every platform.

  The function lives in `@humanjs/core` so future adapters (`@humanjs/puppeteer`, etc.) can reuse it without duplication. `@humanjs/playwright` re-exports it for convenience: `import { bezierPath } from '@humanjs/playwright'`.

  Math adapted from [ghost-cursor](https://github.com/Xetera/ghost-cursor) (MIT, © 2020 Xetera). See `THIRD_PARTY_NOTICES.md` at the repo root for full attribution. Coming next: velocity profiling, micro-jitter, and the `click()` action that consumes this.

- cce64bf: Add `humanizePath()` post-processor for realistic mouse trajectories.

  Takes a raw Bezier path and applies two transformations:

  - **Velocity profile** — resamples the path with a smoothstep-warped arc length, producing the bell-shaped velocity curve observed in human motor studies (small steps at the endpoints, large steps in the middle).
  - **Micro-jitter** — adds Gaussian sub-pixel noise to interior points, simulating natural hand tremor. Endpoints stay exact so click targets land cleanly.

  Both transforms are deterministic given a seeded `Rng`. The individual transforms (`applyVelocityProfile`, `applyMicroJitter`) are also exported for composition or advanced use.

  Coming next: the `click()` action that consumes Bezier path + `humanizePath` to produce visible humanized motion.

- Updated dependencies [cce64bf]
- Updated dependencies [cce64bf]
  - @humanjs/core@0.2.0

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
