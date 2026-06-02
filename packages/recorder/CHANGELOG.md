# @humanjs/recorder

## 0.3.1

### Patch Changes

- 8857b00: Ship the MIT `LICENSE` file inside every package tarball. Each package listed `LICENSE` in its `files` array but had no license file in its own directory, so published tarballs omitted it — this adds the file to each package. Also broadens every package's npm keywords for discoverability.

  Tooling (not published): a `check:exports` task runs `publint --strict` on every package in CI, validating the published exports map, `files`, and type fields against the packed output (warnings fail the check).

- Updated dependencies [a0a11c4]
- Updated dependencies [910260f]
- Updated dependencies [8857b00]
- Updated dependencies [4757040]
- Updated dependencies [54b3c65]
  - @humanjs/playwright@0.8.0

## 0.3.0

### Minor Changes

- 605973c: Recorder code export — turn a recorded session into runnable code.

  - **`Recording.toHumanJS(path)`** — writes a standalone HumanJS script (`createHuman` + `human.*`) that replays the session.
  - **`Recording.toPlaywright(path, options?)`** — writes a `@playwright/test` spec that drives the page through HumanJS, so the generated test runs humanized too. It's built to _be_ a test: runs instant in CI / recorded speed locally, drops timing `sleep()`s (`{ keepSleeps: true }` to keep them), titles the test from the recording's `name` (or `{ title }`), and derives the assertions it safely can (`toBeVisible` from reads, `toHaveValue` from captured inputs). Optional `{ steps: true }` groups actions into `test.step(...)` blocks; `{ baseUrl: true }` relativizes same-origin `goto`s for a portable `use.baseURL` test.

  `@humanjs/recorder`'s `record()` gains a `name` option (becomes the generated test's title).

  Both are available on the `Recording` returned by `human.record()` and by `@humanjs/recorder`'s `record()`. String selectors round-trip verbatim; raw `point(x, y)` targets are emitted with a flag comment (locator/point → selector synthesis is a planned follow-up).

  `@humanjs/mcp`'s `human_stop_recording` now accepts these formats too — a `.ts` filename writes a HumanJS script, `.spec.ts` / `.test.ts` writes a Playwright test — so an AI agent can record a flow and emit a ready-to-commit test directly.

  - **`captureInputs`** (new `human.record()` / `record()` option, default `true`) — records the actual typed/pasted text into the timeline so it flows into exported code. Values typed into `input[type="password"]` are always masked; set `captureInputs: false` to record none. Captured values land in the timeline JSON and exported code — treat those artifacts accordingly.
  - `TimelineEvent` gains an optional `inputValue` field carrying the captured text for `type`/`paste`.

  ```ts
  const rec = await human.record(async () => {
    await human.goto("https://example.com");
    await human.type("Email", "gonzalo@example.com");
  });

  await rec.toHumanJS("session.ts"); // runnable script
  await rec.toPlaywright("session.spec.ts"); // @playwright/test spec
  ```

### Patch Changes

- Updated dependencies [605973c]
  - @humanjs/playwright@0.7.0

## 0.2.0

### Minor Changes

- eba9ebd: `record()` can now record in a persistent profile or attach to a browser you already launched — completing the browser-mode story alongside `@humanjs/mcp` (env/tools) and `@humanjs/playwright` (bring-your-own-page).

  - **`userDataDir`** — record in a persistent profile so logins/cookies survive across runs (sign in once in a headed run, reuse it). Uses `launchPersistentContext`; `headless` / `launch` / `channel` / `viewport` still apply.
  - **`cdpUrl`** — attach to a running browser over CDP (start it with `--remote-debugging-port`) and record its existing context — real logins, tabs, extensions. HumanJS **never closes** a browser it attached to; it only borrows it. Takes precedence over `userDataDir`.
  - **`channel`** — launch an installed browser (`'chrome'`, `'msedge'`) instead of bundled Chromium (default + persistent modes). A channel alone does NOT reuse your profile — pair it with `userDataDir` or `cdpUrl` for logins.

  ```ts
  // Stay signed in across runs
  await record(
    { output: "dashboard.mp4", userDataDir: "./.humanjs-profile" },
    async (human) => {
      await human.goto("https://app.example.com/dashboard");
    }
  );
  ```

  Default behavior is unchanged — omit the new options and you get a fresh ephemeral browser as before.

### Patch Changes

- Updated dependencies [4de26ba]
- Updated dependencies [4de26ba]
  - @humanjs/playwright@0.6.0

## 0.1.1

### Patch Changes

- Updated dependencies [c953630]
- Updated dependencies [7e0194c]
- Updated dependencies [5313f46]
- Updated dependencies [9831727]
- Updated dependencies [ce172e2]
- Updated dependencies [87bbb59]
- Updated dependencies [444a4d3]
  - @humanjs/playwright@0.5.0

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
