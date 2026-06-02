# @humanjs/core

## 0.7.0

### Minor Changes

- a0a11c4: Add form-interaction primitives so real flows (forms, checkout, settings) stay fully humanized instead of dropping back to raw Playwright:

  - **`human.doubleClick(target)`** — same humanized approach as `click()`, double-click dispatch.
  - **`human.check(target)` / `human.uncheck(target)`** — tick/untick a checkbox or radio; clicks only when the state needs to change (a real user doesn't re-click an already-ticked box), and verifies the result.
  - **`human.selectOption(target, values)`** — choose option(s) in a native `<select>`; the cursor moves to the dropdown, then the value is set (firing `input`/`change`).
  - **`human.upload(target, files)`** — attach file(s) to a file input; the cursor moves to the control, then files are set directly (never opens the OS dialog).

  Each is mirrored as an MCP tool (`human_doubleClick`, `human_check`, `human_uncheck`, `human_selectOption`, `human_upload`), exported by the recorder's code generators (`toPlaywright` / `toHumanJS`), and documented in the `@humanjs/skill` primitives reference. `@humanjs/core` gains the matching `KnownActionType` entries so plugins can observe them.

  `human_upload` confines reads to `HUMANJS_UPLOAD_DIR` (default: the server's working dir) and accepts a basename only — `../`, subdirectories, and absolute paths are rejected — so a prompt-injected filename can't read and exfiltrate arbitrary local files to a web form (same path-safety model as the output tools).

- 910260f: Add `human.clear(target)` — clears a text field (input / textarea / contenteditable) with a real humanized keyboard gesture: click to focus, **select-all**, a beat, then **delete**, firing the `input` events the page expects. Pair it with `type()` to replace an existing value rather than append to it. In `speed: 'instant'` it delegates to Playwright's native `locator.clear()`.

  Mirrored as the **`human_clear`** MCP tool, exported by the recorder code generators (`toPlaywright` / `toHumanJS`), documented in the `@humanjs/skill` primitives table, and backed by a new `'clear'` `KnownActionType` in `@humanjs/core`.

### Patch Changes

- 8857b00: Ship the MIT `LICENSE` file inside every package tarball. Each package listed `LICENSE` in its `files` array but had no license file in its own directory, so published tarballs omitted it — this adds the file to each package. Also broadens every package's npm keywords for discoverability.

  Tooling (not published): a `check:exports` task runs `publint --strict` on every package in CI, validating the published exports map, `files`, and type fields against the packed output (warnings fail the check).

- f77ca93: Document the personality + plugin authoring surface in the README — how to build a `Personality` (extend a preset or ship a full profile), publish it as a community `@yourname/personality-*` package, and write a `HumanPlugin`. No API changes; the contract was already exported and stable.

## 0.6.0

### Minor Changes

- 4de26ba: `Human` now re-exports 12 common Playwright `Page` methods so callers don't have to juggle two surfaces (`human.click` here, `page.screenshot` over there).

  ## What's new

  The re-exports are thin forwards — Playwright's behavior unchanged, just reachable from `human.*`:

  ```ts
  await human.screenshot();
  await human.pageText();
  await human.content();
  await human.url();
  await human.title();
  await human.reload();
  await human.goBack();
  await human.goForward();
  await human.waitForLoadState("networkidle");
  await human.waitForURL("/dashboard");
  await human.setViewportSize({ width, height });
  await human.pdf({ path: "out.pdf" });
  ```

  ## Why these specifically

  The locked principle: **if it's a verb a user or agent performs OR a state read about the current page, it's a candidate. If it's lifecycle, environment setup, or power-user JS, it stays on `page`.**

  That keeps `evaluate`, `exposeFunction`, `addLocatorHandler`, `close`, `context`, `browser`, and the rest of Playwright's lower-level surface where they belong — on `page` — so the `human.*` surface stays focused on "what a user does in a browser."

  ## Plugin observability

  Three of the new methods are navigation actions that fire plugin events: `reload`, `goBack`, `goForward`. `KnownActionType` in `@humanjs/core` is extended with the matching variants so plugins switching on action type get IDE autocomplete.

  The other nine (`screenshot`, `pageText`, `content`, `url`, `title`, `waitForLoadState`, `waitForURL`, `setViewportSize`, `pdf`) are pure forwards — no plugin events, no humanization. They're library-side reads or environment ops, not user actions.

  ## Why now

  These land alongside the `@humanjs/mcp` work — the MCP server exposes the same surface as tools, and having the methods on `human.*` first means the MCP layer is a thin wrapper instead of reaching past `human` into `page` for inspection ops.

## 0.5.0

### Minor Changes

- ce172e2: Personality-driven click placement: `MouseProfile` now includes `clickSpread`, controlling how far click points scatter from the target's center.

  Previously, every personality used a hardcoded `1/8` spread inside `pickClickPoint`. `careful` and `distracted` clicked buttons identically — broke the personality contract harder than the typing rhythm or scroll cadence differences mattered. Now each preset has its own value:

  | Personality  | `clickSpread` | What it looks like                                                                          |
  | ------------ | ------------- | ------------------------------------------------------------------------------------------- |
  | `precise`    | `0.10`        | Tightest cluster near center — expert-user aim.                                             |
  | `careful`    | `0.125`       | Slight scatter — same as the previous global default, no behavior change for default users. |
  | `fast`       | `0.15`        | Noticeable scatter — Fitts's Law: speed trades against precision.                           |
  | `distracted` | `0.17`        | Loosest of the four — eye-drift clicks.                                                     |

  The math: σ = `box.dimension × clickSpread`, separately for X and Y. The result is clamped to the box, so values above ~0.5 start hitting edges constantly (and the presets stay well below that).

  `blend()` interpolates `clickSpread` linearly, same as every other personality knob.

  **Migration**: custom personalities built with `extends` continue to inherit the preset's value automatically. Personalities built from scratch (no `extends`) need to set `mouse.clickSpread` explicitly — the field is required. A safe default is `0.125` (the previous global behavior).

- 94f13b3: All built-in personality presets now set `typoCorrectionProbability: 1.0` — the library guarantees the value you pass to `human.type(target, value)` lands in the field as-is.

  | Preset       | Before | After |
  | ------------ | ------ | ----- |
  | `precise`    | `0.99` | `1.0` |
  | `careful`    | `0.95` | `1.0` |
  | `fast`       | `0.90` | `1.0` |
  | `distracted` | `0.70` | `1.0` |

  ## Why

  The old defaults left an uncorrected typo through randomly:

  - `careful` × 16-char field: ~1.6% chance of a silent typo
  - `distracted` × 16-char field: ~26% chance
  - Longer flows (multi-field forms) compound the rate

  That's the worst kind of test failure: rare enough to look like a flake, frequent enough to break trust. Output is still deterministic per-seed, but the field value depends on which seed you happen to pick — and any rotation of seeds (per-test seeding, CI matrix builds) shifts which characters survive. The contract `human.type(target, value)` is the kind of thing tests and AI agents rely on being **seed-invariant** at the output level: same input → same field value, regardless of seed. Personality controls _how_ the value is typed (rate of mid-typing stumbles, key delays, think pauses) — not _what_ lands.

  The visible humanization signal (wrong key → backspace → right key) is fully preserved. Every typo still fires that beat; what changes is that the typo always gets corrected on the way to the final character.

  ## What still works

  - Personality differences are entirely in the typing process. `distracted` still produces visibly more stumbles than `careful`; `precise` still types cleaner.
  - Existing personality overrides still typecheck and work — `typoCorrectionProbability` remains a public field on `TypingProfile`.
  - If you specifically need uncorrected typos in the output (stress-testing form validation, modeling truly inattentive users), override explicitly with eyes open:

    ```ts
    const human = await createHuman(page, {
      personality: {
        extends: "distracted",
        typing: { typoCorrectionProbability: 0.7 },
      },
    });
    ```

    The field's JSDoc flags this as advanced — output stays deterministic given a fixed seed, but the final field-value becomes seed-dependent (change the seed and surviving typos shift), which is rarely what tests want.

  ## Migration

  If you were relying on the old miss rates to seed test data with realistic typos, use the override above. For "test how my form handles bad input," pass the imperfect value directly — that's clearer than rolling dice:

  ```ts
  await human.type("#email", "demi@humanjs.dev"); // intentional typo
  ```

### Patch Changes

- 5313f46: Wires up the long-declared `personality.mouse.misclickProbability` knob: actions that commit on a mouse press now occasionally produce a visible "near-miss" wobble before landing on the target.

  The behavior change is in `@humanjs/playwright`. The `@humanjs/core` patch is a JSDoc update on `MouseProfile.misclickProbability` reflecting the now-wired semantics — no API or runtime changes in core.

  When the probability fires for `click`, `rightClick`, either endpoint of `drag` (grab and drop roll independently), or the implicit focus-acquiring click inside `type` / `paste`:

  1. Cursor walks via Bezier path to a near-miss point — 5–15 px outside an edge of the bounding box (element-bound targets) or 5–15 px from the target coordinate in a random direction (raw-`Point` targets, for canvas/SVG drags).
  2. Brief "oh, I missed" dwell (scaled by personality — same shape as the pre-click settle beat).
  3. Cursor walks the small distance to the real commit point.
  4. Click / mousedown / mouseup fires once, on the target.

  **The misclick is visible cursor motion only — no `mouse.click`, `mouse.down`, or `mouse.up` event fires at the off-target coordinates.** That's deliberate: dispatching real clicks just outside the target risks hitting ancestor / sibling elements with their own handlers (a destructive button, a modal trigger, a navigation link). Since we can't reliably detect "does this element have an `addEventListener`-attached handler?" from outside the page, the safe-by-construction design is to never fire an event anywhere we didn't mean to.

  Drag-over events (`dragover`, `dragenter`, `dragleave`) fire on whatever the cursor passes during a drop-side misclick detour, but those events already fire throughout normal drag motion — the misclick just adds a small extra loop, which reads as exploratory cursor behavior.

  ## What changes for callers

  - `human.click('#target')` and `human.rightClick('#target')` may now show a small cursor detour on the way to the click. The action itself still commits at the resolved coordinates with the same button and same assertions.
  - `human.drag('#card', '#slot')` may near-miss the grab, the drop, both, or neither — each endpoint rolls independently. `mousedown` still fires at the resolved `from`; `mouseup` still fires at the resolved `to`.
  - Raw-`Point` drag endpoints (`human.drag({ x, y }, ...)`) also misclick — the near-miss is picked 5–15 px from the coordinate in a random direction.
  - Action duration is slightly longer when the misclick fires (one extra Bezier walk + a short dwell per fired endpoint).
  - `hover`, `move`, `read`, `scroll`, `press` are unchanged.
  - `type` and `paste` keep their typing / insertion behavior exactly. Their implicit focus-acquiring click goes through the normal `click` path, so it can now occasionally near-miss like a bare `human.click` does — but the keystrokes themselves and the resolved focus target are unaffected.

  This is process humanization: how the click / grab / drop happened differs, not what got clicked or where it landed. Personality controls the _rate_ of near-misses (precise: 0.001, careful: 0.01, fast: 0.005, distracted: 0.05); the per-action behavior is the same shape across all personalities. Drag's effective miss rate is ~2× the per-roll value because both endpoints roll independently — realistic, since drag is two cognitive moments (grab and drop).

  ## What stayed the same

  - The `misclickProbability` field was already declared on `MouseProfile` and set on all four presets — it just never fired. This release wires it up.
  - The preset values are unchanged.
  - All other behavior (auto-scroll, hover dwell, action timeline, plugin events) is unchanged. The misclick is a sub-step of the `'click'` action — it doesn't emit its own timeline event.

  ## Override

  If you specifically want to disable the near-miss (e.g. for tightly-timed assertions where the extra detour matters):

  ```ts
  const human = await createHuman(page, {
    personality: {
      extends: "careful",
      mouse: { misclickProbability: 0 },
    },
  });
  ```

  Or set it higher than the preset for stronger humanization signal in demos. The field is part of the public `MouseProfile` type.

  ## Edge cases

  - **Cursor already on the target.** When the action starts with the cursor already inside the target's bounding box (or within a few pixels of a raw-Point target), the near-miss beat is suppressed. A real user doesn't aim away from a button they're already hovering — the misclick is fundamentally an approach pattern, so no approach means no overshoot. The probability roll still happens (so RNG state stays seed-deterministic), but the beat itself is skipped. This catches the case where the user scrolled into the element, where the previous action left the cursor on the target, or any other "already there" scenario.
  - **Targets at the viewport edge:** if the candidate misclick point would land off-screen, the misclick is skipped for that action (rather than producing a "near-miss" that gets clamped back onto the target).
  - **Determinism:** same seed produces the same misclick decisions and same misclick coordinates. Misclick fires/skips deterministically per seed, like every other humanization knob.

  ## Note for snapshot-style tests

  Wiring `misclickProbability` into the mouse path consumes one RNG value per misclick decision — once per `click` / `rightClick` action, and twice per `drag` (one per endpoint). Existing seeded sessions will produce **different intermediate cursor coordinates** after upgrade — even when no misclick fires — because downstream RNG state is shifted by those consumers.

  Action outcomes (click coordinates, mousedown / mouseup positions, the resolved button, the target element) are unchanged. Only tests snapshotting the exact mouse-move sequence against a seed will need to refresh their snapshots. Tests asserting page state, form values, or action results (the typical kind) are unaffected.

- 87bbb59: **Breaking:** `human.shortcut(chord)` is renamed to `human.press(key)` — `shortcut('Tab')` always typechecked, but the name read wrong for single keys. `press` is what Playwright's own `keyboard.press()` does, and reads naturally for both bare keys and chords.

  ```ts
  // Before
  await human.shortcut("Mod+S");
  await human.shortcut("Enter"); // worked, but the name read wrong

  // After
  await human.press("Mod+S"); // chord
  await human.press("Tab"); // bare key — what `shortcut('Tab')` always meant
  await human.press("Enter");
  await human.press("Escape");
  ```

  ## Why

  A single key like `Tab` isn't a "shortcut," and forcing users through `human.shortcut('Tab')` was a real readability smell. `press` matches Playwright's own `keyboard.press()` — one method that accepts either a bare key or a `Modifier+Key` chord — and removes the API duplication.

  ## What changed

  | Old                                                     | New                                  |
  | ------------------------------------------------------- | ------------------------------------ |
  | `human.shortcut(chord)`                                 | `human.press(key)`                   |
  | `Shortcut` type                                         | `KeyOrChord`                         |
  | `ShortcutKey` type                                      | `KeyName`                            |
  | `ShortcutModifier` type                                 | `KeyModifier`                        |
  | `ShortcutResult` type                                   | `PressResult`                        |
  | Action params `{ type: 'shortcut', params: { chord } }` | `{ type: 'press', params: { key } }` |
  | Runtime error: `"Invalid shortcut modifier: ..."`       | `"Invalid key modifier: ..."`        |

  ## Type behavior

  `KeyOrChord` is fully enumerated — `KeyName | ${KeyModifier}+${KeyName} | ${KeyModifier}+${KeyModifier}+${KeyName}` — so every `Modifier+Key` combination is an autocomplete-able literal. Type `'Shift+'` in your IDE and you get the full `Shift+A`, `Shift+B`, …, `Shift+Tab` list as completions.

  ```ts
  await human.press("Tab"); // ✓ autocompletes from KeyName
  await human.press("Mod+S"); // ✓ autocompletes from Modifier × KeyName
  await human.press("Shift+ArrowDown"); // ✓
  await human.press("Mod+Shift+P"); // ✓ two-modifier chord
  await human.press("Mosd+S"); // ✗ TS error — modifier closed set
  await human.press("Hyper+S"); // ✗ TS error
  await human.press("BracketLeft"); // ✗ TS error — outside KeyName
  ```

  **Escape hatch.** Uncommon keys (`'BracketLeft'`, `'NumpadAdd'`, locale keys) and 3+ modifier chords (`'Ctrl+Shift+Alt+K'`) need a cast at the call site — the runtime parser handles them, the type just doesn't enumerate them:

  ```ts
  await human.press("Mod+BracketLeft" as KeyOrChord);
  await human.press("Ctrl+Shift+Alt+K" as KeyOrChord);
  ```

  We tried a `(string & {})` escape hatch on the key portion of chords to make these work without a cast, but the cost was unacceptable: any `(string & {})` member in the union collapses TypeScript's template-literal IntelliSense to a single wide template, so completions for `'Shift+...'` / `'Mod+...'` disappear entirely. Autocomplete for the 95% case is the killer feature; the cast for rare keys is a worthwhile trade.

  ## Migration

  Most call sites are a pure rename:

  ```diff
  - import { type Shortcut } from '@humanjs/playwright';
  + import { type KeyOrChord } from '@humanjs/playwright';

  - await human.shortcut('Mod+S');
  + await human.press('Mod+S');

    // Plugin handler — silent failure mode without this update:
  - if (action.type === 'shortcut') { console.log(action.params.chord); }
  + if (action.type === 'press') { console.log(action.params.key); }
  ```

  **Stricter type — note for uncommon-key chords.** The old `Shortcut` type included a `(string & {})` escape hatch on the key portion of chords, so `human.shortcut('Mod+BracketLeft')` typechecked without a cast. `KeyOrChord` is fully enumerated for IntelliSense (so `'Shift+'` autocompletes every `Shift+<key>` combo), and the trade-off is that uncommon-key chords now need an explicit cast:

  ```diff
  - await human.shortcut('Mod+BracketLeft');
  + await human.press('Mod+BracketLeft' as KeyOrChord);

  - await human.shortcut('Ctrl+Shift+Alt+K');
  + await human.press('Ctrl+Shift+Alt+K' as KeyOrChord);
  ```

  If you have a lot of these in one codebase, a tiny local helper keeps the cast contained:

  ```ts
  const press = (k: string) => human.press(k as KeyOrChord);
  await press("Mod+BracketLeft");
  ```

  `@humanjs/core`'s `KnownActionType` swapped `'shortcut'` for `'press'` to match. The `(string & {})` widening on `ActionType` means custom adapters emitting `'shortcut'` still typecheck against the loose form, but they won't autocomplete and they won't match `action.type === 'press'`-style plugin handlers.

## 0.4.0

### Minor Changes

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

## 0.3.0

### Minor Changes

- 52103df: Add `planScroll()` — the deterministic, axis-agnostic scroll planner that turns a (`from`, `to`) request into a sequence of `ScrollSegment`s shaped by a `ScrollProfile` and a seeded `Rng`.

  The planner models real wheel motion: bell-curve velocity (sin(i/n × π) weights across segments), opt-in mid-scroll pauses, and an opt-in overshoot-and-correct phase where phase 1 goes past the target, the cursor "realizes" and pauses (~2.5× the configured pause), then phase 2 corrects back. Same seed produces identical segment sequences on every run and every platform — the math is pure, with no DOM and no `y`-axis bias in the names.

  `Personality.scroll` is now a stable, publicly-exported shape (`ScrollProfile`) controlling segments-per-Kpx, segment delay + jitter, pause probability + duration, and overshoot probability + ratio. All four built-in presets (`careful`, `fast`, `distracted`, `precise`) ship sensible scroll defaults — `distracted` overshoots aggressively, `precise` never overshoots, `careful` and `fast` sit in between.

  New public exports:

  - `planScroll(from, to, profile, rng, options?) → readonly ScrollSegment[]`
  - `ScrollProfile`, `ScrollSegment`, `PlanScrollOptions` types

  Adapters (`@humanjs/playwright` ships next; future `@humanjs/puppeteer` will follow) build the I/O layer on top of this — the planner itself is reusable across any browser-driver that can deliver wheel events or assign `scrollLeft`/`scrollTop`.

## 0.2.0

### Minor Changes

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

## 0.1.0

### Minor Changes

- d48f654: Add `blend(a, b, ratio)` — composes two personalities into a new one by linearly interpolating every numeric field. Accepts preset names, full personalities, or extensions on either side, and blends are themselves composable.

  ```ts
  const mostlyCareful = blend("careful", "distracted", 0.3); // 70% careful, 30% distracted
  ```

  Ratios outside `[0, 1]` clamp. The result is a fresh `Personality` with the source names and ratio encoded in `result.name` for log clarity.

- 2561c53: Add the `Personality` type and the four built-in presets: `careful`, `fast`, `distracted`, and `precise`.

  `Personality` is the stable, publicly exported data shape every humanization run reads from. Community packages can publish `@anything/personality-*` against this shape — the type is exported from `@humanjs/core` and treated as a v1 contract.

- 2d76237: Add the plugin contract: `HumanPlugin`, `PluginContext`, `HumanAction`, `ActionResult`, plus `KnownActionType` and `ActionType`.

  Plugins are plain objects with four optional lifecycle hooks — `install`, `beforeAction`, `afterAction`, `onError`.

  `ActionType` is a soft union: `KnownActionType` literals (`'click'`, `'type'`, `'scroll'`, …) autocomplete in IDEs, but any string still typechecks. This gives plugin authors discoverability while letting adapters emit custom or experimental action types without a core release.

  Observation-only in v1: hooks cannot transform actions. Action-transform hooks may arrive later as a non-breaking addition once concrete use cases exist.

- bb74f65: Add `resolvePersonality()` and its supporting types `PersonalityConfig`, `PersonalityExtension`, and `PresetName`.

  `resolvePersonality()` turns the layered config — a preset name like `'careful'`, a preset with partial overrides like `{ extends: 'careful', typing: { typoProbability: 0.1 } }`, or a fully built `Personality` — into a flat `Personality`. Never mutates the base preset.

  This is the entry point every consumer hits, enabling the public layered API from `createHuman({ personality: ... })`.

- c4dd128: Add `createRng` and the `Rng` interface — a seedable PRNG used by every randomized humanization decision (mouse curves, typing delays, dwell times, misclicks). Identical seeds produce identical sequences on every run and every platform, which is what makes humanization snapshot-testable. Algorithm is mulberry32 with FNV-1a string hashing for seeds; Gaussian samples via Box-Muller.
