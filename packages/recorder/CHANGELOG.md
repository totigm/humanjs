# @humanjs/recorder

## 0.1.0

### Minor Changes

- bab5e49: Initial release of `@humanjs/recorder` — one-call session recording for HumanJS.

  ```ts
  import { record } from "@humanjs/recorder";

  await record(
    { output: "demo.mp4", url: "https://example.com" },
    async (human) => {
      await human.click("a");
      await human.type("#search", "humanjs");
    }
  );
  // → demo.mp4 written
  ```

  A single function call wraps the entire lifecycle: browser launch, context creation, page setup, human session, the recorded callback, frame capture + encoding via the bundled `ffmpeg-static`, and cleanup. The marketing / demo / tutorial use case in one line.

  Two overloads: `record(fn)` for no-options recording (timeline-only by default), and `record(options, fn)` when you want a video output or other configuration.

  Quality presets pick both source viewport and ffmpeg encoding settings:

  - `'fast'` — 720p, JPEG q=85, CRF 23, preset fast (iteration)
  - `'standard'` — 1080p, JPEG q=90, CRF 20, preset fast (balanced)
  - `'high'` (default) — 1080p, JPEG q=95, CRF 18, preset slow, tune animation (marketing-grade)
  - `'lossless'` — 1080p, PNG capture, CRF 12, preset veryslow (archival)

  The visible cursor overlay is auto-installed by default so the recorded video shows mouse motion; opt out with `cursor: false`.

  **Public surface:**

  - `record(fn)` / `record(options, fn)` — the one-call helper
  - `RecordOptions`, `RecordCallback` — typed option/callback shapes
  - `Recording` (re-exported from `@humanjs/playwright`) — so users can type local variables without a second import

  For users who need to compose with existing Playwright code, `human.record()` from `@humanjs/playwright` is the lower-level API this package wraps.

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

### Patch Changes

- Updated dependencies [bab5e49]
- Updated dependencies [bab5e49]
- Updated dependencies [bab5e49]
- Updated dependencies [bab5e49]
- Updated dependencies [bab5e49]
  - @humanjs/playwright@0.4.0
