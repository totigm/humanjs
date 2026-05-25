# @humanjs/playwright

## 0.4.0

### Minor Changes

- bab5e49: Add humanized session recording — capture a slice of a Playwright session as mp4 or webm, plus a structured JSON action timeline.

  ```ts
  import {
    chromium,
    createHuman,
    installMouseHelper,
  } from "@humanjs/playwright";

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await installMouseHelper(context);

  const human = await createHuman(page);

  const rec = await human.record(async () => {
    await human.click("#login");
    await human.type("#email", "demo@humanjs.dev");
  });

  await rec.toVideo("demo.mp4");
  await rec.toTimeline("demo.json");
  await browser.close();
  ```

  New public surfaces:

  - **`human.record(cb)`** — records the wall-clock window of the callback by polling `page.screenshot()` at the target FPS and writing each frame to a temp directory. Returns a `Recording`. Supports `{ video: false }` for timeline-only mode (zero capture overhead) and `{ quality: 'fast' | 'standard' | 'high' | 'lossless' }`.
  - **`Recording`** — class with `toVideo(path, options?)` (ffmpeg-assembled mp4/webm with quality presets and ffmpeg knob overrides), `toTimeline(path)` (structured JSON), and `.timeline` (in-memory). All exporters are repeatable; captured frames live until `dispose()` (or until the sweep-on-exit handler cleans them at process end — see the toGif changeset for the lifecycle details).
  - **`Timeline`** + **`TimelineEvent`** — public schema for the captured action timeline, versioned at `1`. Intended for observability pipelines, replay infrastructure, and debugger UIs.
  - **Re-exports**: `chromium`, `firefox`, `webkit`, `Browser`, `BrowserContext`, `Page`, `Locator`, `LaunchOptions`, `BrowserContextOptions`, `ElementHandle` from Playwright — so users have a single import surface for the integration's common case.

  `installMouseHelper` also got a robustness fix: the visible cursor now survives `page.setContent()` (which Playwright doesn't treat as a navigation, so `addInitScript` doesn't fire). The helper now also re-injects on every `domcontentloaded` event, and the in-page idempotency guard checks for the cursor DOM element instead of a window flag (the window persists across `setContent` but the element doesn't).

  For a one-call API that owns the entire browser/page lifecycle, see [`@humanjs/recorder`](../recorder).

- bab5e49: `human.read()` now defaults `withMotion` to `true` (was `false`).

  The cursor scans across the target's bounding box while the dwell elapses by default — "reading" implies looking, and looking implies motion. The opt-in semantics felt backwards: every demo and most user code was passing `{ withMotion: true }`, and skipping it produced an invisible "just sleep" that looked broken in recordings.

  Pass `{ withMotion: false }` to skip motion when you only care about the temporal pattern — typical AI-agent use case where the cursor position is irrelevant:

  ```ts
  // Default — cursor traces the passage during the dwell
  await human.read(".passage");

  // Opt-out — just the dwell, no cursor motion
  await human.read(".passage", { withMotion: false });
  ```

  **Migration note**: code that called `human.read(selector)` and depended on the cursor staying put will see the cursor scan across the target. Add `{ withMotion: false }` to restore the previous behavior.

- bab5e49: Add `Recording.toGif(path, options?)` for animated-GIF export, and make exporters repeatable.

  ```ts
  const rec = await record({ output: "demo.mp4" }, async (human) => {
    await human.goto("https://humanjs.dev");
    await human.click("#cta");
  });
  await rec.toGif("demo.gif", { fps: 15, width: 720 });
  await rec.toTimeline("demo.json");
  await rec.dispose();
  ```

  Palette-optimized GIF output (per-recording `palettegen` + `paletteuse`, Bayer dither) so README/PR/Slack-embedded GIFs stay sharp at small file sizes. `record()` from `@humanjs/recorder` auto-dispatches to `toGif` when `output` has a `.gif` extension.

  `Recording.toVideo()` and `Recording.toGif()` are now **repeatable and interleavable** — they read the captured frames, they don't consume them. Captured frames are swept automatically by a `process.on('exit')` handler installed on first use, so casual scripts don't need to call `dispose()` at all. For predictable mid-process cleanup (long-running services, batch jobs), call `await rec.dispose()` explicitly, or use `await using rec = await record(...)` (TS ≥ 5.2 / Node ≥ 20.4) — `Recording` implements `Symbol.asyncDispose`.

  Previously each exporter was single-use and the two were mutually exclusive — that was an over-eager cleanup choice, not a real constraint.

  Also fixes a timeline-fidelity bug: `human.sleep(ms)` now emits a `'sleep'` action through the plugin / recording pipeline (added to `KnownActionType` in `@humanjs/core`). Previously, pauses were invisible to the recorded timeline, which would have broken upcoming exporters (`toPlaywright`, `toHumanJS`) that replay timelines.

- bab5e49: Add a `sleep(ms)` helper — exported from `@humanjs/core` and re-exported from `@humanjs/playwright`, plus available as a method on the `Human` instance for users who already have one in scope.

  ```ts
  // Standalone import — works without a Human session
  import { sleep } from "@humanjs/playwright";
  await sleep(800);

  // Or via the Human instance — no extra import needed when you have one
  const human = await createHuman(page);
  await human.click("#start");
  await human.sleep(400);
  await human.type("#email", "demo@humanjs.dev");
  ```

  Trivial implementation (`new Promise((r) => setTimeout(r, ms))`) but exported because it shows up in every demo and most user code that paces humanized actions for visual demos or recordings. Playwright's own `page.waitForTimeout()` is the alternative but Playwright's docs discourage it; an explicit `sleep` makes the intent clearer.

  **Not humanized**: `human.sleep(ms)` is a raw setTimeout — not scaled by personality or speed mode, and no plugin events fire. Use it for generic pacing between humanized actions. If you want delays that scale with personality, the per-action `dwell` settings (`preClickMs`, `postActionMs`) and the personality's `speed` multiplier handle that automatically inside the humanized primitives.

### Patch Changes

- bab5e49: Two hardening fixes surfaced during branch review of the recorder pillar:

  - **`installMouseHelper(target)` is now idempotent.** A second call on the same `Page` or `BrowserContext` is a no-op instead of stacking duplicate `domcontentloaded` and `'page'` listeners. The in-page DOM guard already made the install script itself a no-op, but the listener accumulation meant N round-trips to the browser per navigation after N installs. Now an early-return guard (via `Symbol.for('@humanjs/playwright:mouse-helper:installed')` stashed on the target) skips repeat work.

  - **Capture loop write failures no longer poison the queue.** Previously, a single failed `writeFile` (e.g. disk pressure mid-recording) would reject every subsequent write via promise-chain propagation, which in turn made `human.record()`'s `abort()` path throw before its `rm()` cleanup — leaking the temp directory and masking the original error. Each write now fails independently: one frame is dropped, a warning is logged, and the rest of the capture + cleanup proceeds normally. The chain (`pendingChain`) was replaced with an array fed to `Promise.allSettled` in the loop's settle step.

  Neither fix changes the public API. They make existing behavior robust under failure conditions that were unlikely but unrecoverable.

- Updated dependencies [bab5e49]
- Updated dependencies [bab5e49]
  - @humanjs/core@0.4.0

## 0.3.0

### Minor Changes

- 52103df: Add `human.scroll(target?, options?)` — the scroll pillar, built on top of `planScroll` from `@humanjs/core`.

  ```ts
  await human.scroll(); // 'natural': one viewport
  await human.scroll("top"); // back to the top
  await human.scroll("end"); // all the way down
  await human.scroll("#pricing"); // selector
  await human.scroll(locator); // Locator
  await human.scroll({ by: 480 }); // relative offset
  await human.scroll({ to: 1200 }); // absolute position
  await human.scroll("#card", { axis: "x" }); // horizontal
  await human.scroll("#row", { within: ".scroller" }); // inside a container
  await human.scroll("#hero", { block: "nearest" }); // minimum scroll
  await human.scroll("#testimonials", { overshoot: true }); // force overshoot
  ```

  Routes between window and container, X and Y axis. Window scrolls dispatch real `page.mouse.wheel()` events so page-level wheel listeners fire. Container scrolls assign `scrollLeft` / `scrollTop` directly because Playwright's wheel doesn't reliably route into nested overflow scrollers.

  `block` mirrors `Element.scrollIntoView({ block })`: `'start'` (default), `'center'`, `'end'`, and `'nearest'` — `'nearest'` does the minimum scroll, no-opping if the element is already fully visible along the chosen axis.

  Returns `ScrollResult` with `{ from, to, distance, durationMs }` so observers know where the scroll landed. Each scroll flows through the plugin pipeline as `{ type: 'scroll', params: { target } }`.

  `speed: 'instant'` bypasses the planner and uses Playwright's native scroll. In `human` and `fast` modes, scrolls are deterministic given a session seed.

  New public exports: `ScrollTarget`, `ScrollOptions`, `ScrollResult` (plus a re-export of `ScrollProfile` from `@humanjs/core`).

### Patch Changes

- Updated dependencies [52103df]
  - @humanjs/core@0.3.0

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
