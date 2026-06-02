# @humanjs/playwright

## 0.8.0

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

- 4757040: Add page perception for AI agents: `human.outline(target?)` returns the page's accessibility-tree outline (every interactive element and landmark by ARIA role + accessible name, as compact YAML — Playwright's `ariaSnapshot`). It's the token-efficient way for an agent to see what's actionable and pick a selector: the names map directly to `getByRole` / accessible-name selectors, which HumanJS already favors. Pass a `target` to scope it to a region.

  Exposed over MCP as **`human_outline`** (inspection tool, alongside `human_page_text` / `human_get_html`), and documented in the `@humanjs/skill` selector-strategy guide.

  `@humanjs/playwright`'s `playwright` peer dependency floor moves from `>=1.40.0` to `>=1.49.0` — the version where `ariaSnapshot` landed.

- 54b3c65: Add a Playwright Test fixture at the `@humanjs/playwright/test` subpath. It extends `@playwright/test`'s `test` with a ready-to-use `human` fixture — bound to the test's `page`, seeded from the test title (deterministic per test), and instant in CI / humanized locally — so specs skip the `createHuman` boilerplate:

  ```ts
  import { test, expect } from "@humanjs/playwright/test";

  test("checkout", async ({ human, page }) => {
    await human.goto("/cart");
    await human.click("Checkout");
    await expect(page).toHaveURL(/success/);
  });
  ```

  Customize per file or project via `test.use({ humanOptions: { … } })`. `@playwright/test` is an optional peer dependency (only needed for this subpath; the package root is unaffected).

  The recorder's `toPlaywright()` code export now generates specs that use this fixture — `import { test, expect } from '@humanjs/playwright/test'` plus `test.use({ humanOptions: … })` carrying the recorded personality/seed/speed — instead of a per-test `createHuman` call. (`toHumanJS()`, the standalone script export, is unchanged.)

### Patch Changes

- 8857b00: Ship the MIT `LICENSE` file inside every package tarball. Each package listed `LICENSE` in its `files` array but had no license file in its own directory, so published tarballs omitted it — this adds the file to each package. Also broadens every package's npm keywords for discoverability.

  Tooling (not published): a `check:exports` task runs `publint --strict` on every package in CI, validating the published exports map, `files`, and type fields against the packed output (warnings fail the check).

- Updated dependencies [a0a11c4]
- Updated dependencies [910260f]
- Updated dependencies [8857b00]
- Updated dependencies [f77ca93]
  - @humanjs/core@0.7.0

## 0.7.0

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

## 0.6.0

### Minor Changes

- 4de26ba: `human.click()` and `human.rightClick()` now accept a raw `Point` (`{ x, y }`), not just a selector or `Locator` — matching `move()` and `drag()`, which already did.

  This is the Computer-Use-style fallback: when you can _see_ a control (in a screenshot, say) but have no clean selector for it — icon-only buttons, canvas, SVG, custom widgets — click the visible coordinates directly:

  ```ts
  await human.click({ x: 640, y: 360 }); // humanized walk, then click the point
  await human.rightClick({ x: 640, y: 360 }); // same, context-menu button
  ```

  Element targets are unchanged: the click point is still Gaussian-distributed inside the box, auto-scroll still fires, and the misclick beat still picks a near-miss "outside the box." For a raw `Point`, the exact coordinates are clicked, no auto-scroll (the caller owns the point), and the misclick beat near-misses "around the point" — the same shape `drag` already uses for raw-coordinate endpoints.

  In `speed: 'instant'`, a `Point` dispatches a single `mouse.click()` at the coordinates; element targets keep using Playwright's native `locator.click()`.

  This lands primarily to back `@humanjs/mcp`'s coordinate-click fallback, but it's a coherent library improvement on its own — `click` accepting a `Point` was a gap given `move` and `drag` already did.

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

### Patch Changes

- Updated dependencies [4de26ba]
  - @humanjs/core@0.6.0

## 0.5.0

### Minor Changes

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

- 9831727: Implements the primitives that CLAUDE.md's public API shape advertised but the codebase didn't yet ship — closing the documentation/reality gap on `@humanjs/playwright`'s Human surface — plus a new `move()` primitive for pure positional cursor motion:

  ```ts
  await human.rightClick("#card"); // context menu
  await human.hover('button[aria-label="Help"]'); // hover without clicking
  await human.move({ x: 600, y: 400 }); // pure positioning (canvas, dead space, cinematic beats)
  await human.move("#anchor"); // or to an element, no settle dwell
  await human.drag("#card-1", "#slot-3"); // selector → selector
  await human.drag("#slider", { x: 400, y: 220 }); // selector → point
  await human.paste("#code-editor", longString); // Cmd-V style, no per-key timing
  await human.shortcut("Mod+S"); // cross-platform Save
  await human.shortcut("Cmd+Shift+P"); // literal Meta+Shift+P
  await human.shortcut("Control+C"); // literal Ctrl+C (works on Mac too)
  await human.shortcut("Enter"); // single key
  ```

  ## What's new

  - **`human.rightClick(target)`** — same Bezier path + hover-dwell as `click()`, dispatches with `button: 'right'`.
  - **`human.hover(target)`** — moves the cursor along a humanized path and settles, no click. Includes a post-arrival dwell to let hover-state UI fire (tooltips, dropdowns). Element-bound.
  - **`human.move(target)`** — pure positional cursor motion. Accepts `Locator | string | Point`. No settle dwell, no element interaction. Distinct from `hover`: `hover` is "hover an element so hover UI fires," `move` is "place the cursor here." Use `move` for canvas/SVG/dead-space positioning, pre-shortcut placement, or cinematic beats.
  - **`human.drag(from, to)`** — humanized motion to `from`, mouse-down, second humanized path to `to` with the button held, mouse-up. Both endpoints accept `Locator | string | Point` — the `Point` form is essential for canvas/SVG/slider drags where the destination isn't a DOM element.
  - **`human.paste(target, value)`** — drives an implicit click to focus (same pattern as `type`), then dumps the value via `page.keyboard.insertText`. The Cmd-V semantic — fast, no per-character rhythm. The implicit click is a sub-step of the paste action, same as `type`'s.
  - **`human.shortcut(chord)`** — keyboard chord dispatcher with platform-aware `Mod` token. Detailed modifier rules in the JSDoc; new `'shortcut'` action type emitted to plugins with the original chord string in `params`. Does **not** move the cursor — keyboard shortcuts dispatch against focus, not cursor position. Compose with `click`/`hover`/`move` when you need both.

    **Typed chord parameter.** `chord` is a `Shortcut` — a template-literal union of every (canonical) modifier × key combination up to two modifiers. IDEs autocomplete valid chords as you type (`'Mod+S'`, `'Cmd+Shift+P'`, `'Ctrl+Alt+Delete'`), and **invalid modifiers are caught at compile time**: `'Mosd+S'` and `'Hyper+S'` are TypeScript errors, not runtime errors. The escape hatch lives on the key portion only — uncommon keys (`'Mod+BracketLeft'`, `'Mod+NumpadAdd'`, locale-specific keys) still typecheck under a known modifier. 3+ modifier chords (`'Ctrl+Shift+Alt+X'`) typecheck through the same key-side escape hatch; the cap at two literal modifiers is a TypeScript size-of-union constraint, not a runtime limit. Lowercase modifiers (`'mod+s'`) and bare uncommon keys without a modifier (`'BracketLeft'` alone) are TS errors too — runtime still accepts them, but the type steers toward canonical form for codebase consistency.

  ## New public types

  - **`Shortcut`** — the typed chord union used by `human.shortcut(chord)`. Importable for users typing chord strings in their own helpers / config.
  - **`ShortcutModifier`** — the canonical-case modifier names (`'Mod'`, `'Cmd'`, `'Ctrl'`, `'Alt'`, `'Shift'`, …). Plus aliases (`'Command'`, `'Control'`, `'Option'`, `'Win'`, `'Super'`, `'CmdOrCtrl'`).
  - **`ShortcutKey`** — the canonical bare-key set (`'A'`–`'Z'`, `'0'`–`'9'`, `'F1'`–`'F12'`, `'ArrowUp'`, `'Enter'`, etc.). Uncommon keys go through the `Shortcut` union's key-side escape hatch.
  - **`MouseTarget`** — `Locator | string | Point`. Used by `human.move()` and `human.drag()`. Was internal-only before this release; now exported so users can type local variables to that shape without a deep import.

  ## Modifier semantics for `shortcut`

  | Token                                    | Resolves to                          | Notes                                                                                               |
  | ---------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
  | `Mod`, `CmdOrCtrl`                       | `Meta` on macOS, `Control` elsewhere | The right token for cross-platform app shortcuts                                                    |
  | `Cmd`, `Command`, `Meta`, `Win`, `Super` | `Meta` keycode                       | Literal — does **not** auto-translate to Control. Same physical key on every OS                     |
  | `Ctrl`, `Control`                        | `Control` keycode                    | Literal — stays Control on every platform, so Mac-specific things like terminal `Ctrl+C` still work |
  | `Alt`, `Option`, `Opt`                   | `Alt` keycode                        | Literal                                                                                             |
  | `Shift`                                  | `Shift` keycode                      | Literal                                                                                             |

  Case-insensitive on both modifiers and key names. Invalid modifiers throw with a useful error message listing the valid options.

  ## Internal refactor

  `executeClick` now accepts an optional `{ button }` option (used by both `human.click` and `human.rightClick`); previously the button was hardcoded. The mouse executor extracts a `moveToTarget` helper shared between click and hover, and a `resolveTargetPoint` helper (renamed from the internal `resolveDragTarget`) that handles selector/Locator/Point endpoints for both `drag` and `move`. The Human factory introduces a `mouseCtx()` accessor so every mouse primitive reads from the same `lastMousePosition` closure — successive actions chain off where the cursor actually was, including across the new primitives.

  ## Quality

  - 167 playwright unit tests (was 123) — 44 new tests covering the six primitives, their event emission, instant-mode bypass paths, and edge cases.
  - `resolveChord` is exported for the test suite; 17 of those new tests are pure-function coverage of the parser (platform mapping, aliases, case-insensitivity, error paths).
  - 10 integration tests still green. Lint + typecheck clean.

  ## Migration

  None — all five methods are net-new on the `Human` interface. No existing behavior changes. The `executeClick` signature gained an optional third argument (`ClickOptions`); the previous two-argument call sites continue to work unchanged.

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

- 444a4d3: `human.type()` now clicks the target before typing in humanized speed modes (`'human'` and `'fast'`).

  Previously, `human.type(selector, value)` called `locator.focus()` directly — a programmatic focus with no cursor motion. A real user doesn't teleport-focus a field; they move their cursor to it and click. The new behavior moves the cursor along a Bezier path to the input, clicks it (which triggers a real focus event via the click), then types.

  ```ts
  await human.type("#email", "demo@humanjs.dev");
  //  → cursor moves to #email
  //  → click event fires (focuses the input naturally)
  //  → typing proceeds with realistic per-key rhythm
  ```

  The implicit click is a sub-step of the type action — **not** its own timeline event. `human.type()` still emits exactly one `'type'` event, the same way `human.click()` already does an implicit hover-before-click motion without emitting a separate `'hover'` event. This keeps timelines compact and the `toHumanJS()` exporter round-trip clean: `[type]` → `human.type(s, v)` → click+type on replay.

  **Skipped when:**

  - `speed: 'instant'` — the whole point of instant mode is to bypass humanization for fast CI runs.
  - The value is empty — no typing to set up, no click needed.

  **Migration**: code that called `human.type(selector, value)` and depended on the cursor staying put will see the cursor move to the input. To opt out of cursor motion entirely for a typing action, use `speed: 'instant'` (bypasses all humanization) or call `page.locator(selector).fill(value)` directly — `@humanjs/playwright` re-exports the Playwright primitives, so no second import is needed.

### Patch Changes

- c953630: Mouse primitives now auto-scroll the target into view before interacting with it.

  Before this fix, `human.click('#below-the-fold')` (and the same for `hover`, `rightClick`, `drag`, `type`, `paste`, `move`) read the element's viewport-relative bounding box and fed those coordinates straight into `page.mouse.move/click`. When the element lived below the fold, the resolved `y` exceeded the viewport height and the mouse dispatched off-screen — the click silently missed and the test failed in a confusing way several actions later.

  The fix lives in the shared locator resolver: when the box's center isn't inside the viewport, the resolver triggers a humanized scroll first (or `scrollIntoViewIfNeeded` in `speed: 'instant'` mode), then re-reads the box. `block: 'center'` lands the target in the middle of the viewport — the position from which a real user would actually look at and interact with an element. Earlier iterations used `'nearest'` (minimum-scroll), but that left the target clinging to the viewport edge, which read as robotic. Raw `Point` targets (`human.drag({ x, y }, ...)`, `human.move({ x, y })`) bypass auto-scroll entirely; explicit coordinates are the caller's responsibility.

  This matches what Playwright's own `locator.click()` does internally — every previous `Human` action that went through Playwright's actionability checks already auto-scrolled. The bug was specific to our humanized paths reading coordinates without the same guard.

- 7e0194c: `drag` is more robust against Chrome's native edge-scroll-during-drag behavior, fixing two related cases where the page would scroll wildly mid-drag.

  ## What's fixed

  **1. Mixed-endpoint drags now stay geometrically consistent across auto-scroll.** When a drag is from an element to a raw `Point` (`human.drag('#slider-thumb', { x, y })`) and the element auto-scrolls into view, the raw `Point` now shifts by the same scroll delta. This preserves the "same visual position" relationship the caller intended — callers usually compute raw Points from element positions they see right now, so when the page scrolls during resolution, the Point should follow. Otherwise a horizontal slider drag silently becomes diagonal as soon as the thumb auto-scrolls and the raw Point stays put — and the cursor walking off-viewport then triggers native edge-scroll.

  **2. Element×element drags pre-scroll when the Bezier curve would extrude.** Both endpoints might be individually in-viewport (so per-endpoint auto-scroll didn't fire), yet the curve between them — control points perpendicular-offset by up to `distance × curvature` — can pop out while the mouse button is held. The library now computes a conservative bounding box for the path (the from→to line inflated by `distance × curvature` on each side) and, if it exceeds the viewport, pre-scrolls just enough plus a 20 px safety margin to bring it back inside.

  ## How it composes

  The resolve-time shift runs first (any auto-scroll from `readBoxWithAutoScroll` shifts raw Points by its delta). Then the curve-aware check runs for element×element drags. In practice these two cover the realistic cases:

  | Drag shape            | Behavior                                                                                                                                                                        |
  | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | element → element     | Resolve-time auto-scroll if either is off-viewport, plus curve-aware pre-scroll if the curve still wouldn't fit                                                                 |
  | element → raw Point   | Resolve-time auto-scroll for the element brings it in view; raw Point shifts by the scroll delta; drag stays geometrically consistent                                           |
  | raw Point → element   | Symmetric                                                                                                                                                                       |
  | raw Point → raw Point | No auto-scroll (caller owns both coordinates) — the curve-aware check doesn't fire either, because any additional scroll would shift both points further and chase its own tail |

  ## Examples

  **The slider case** (the motivating example): `human.drag('#slider-thumb', { x: 800, y: thumb.y + 11 })` where the thumb is below the viewport now works without an explicit pre-scroll. The thumb auto-scrolls into the viewport center, the raw Point's y shifts by the same delta to stay aligned with the (now-centered) thumb, and the drag walks horizontally as the caller intended.

  **Element×element near an edge**: dragging a card from a slot near the viewport bottom to another nearby slot now pre-scrolls before mousedown when the path would dip out of viewport. Previously this triggered edge-scroll mid-drag and walked the page hundreds of pixels.

  ## Determinism

  The scroll fires deterministically based on resolved endpoint coordinates, personality curvature, and viewport size — same seed produces the same scroll decision. After the scroll, element endpoints are re-resolved (one extra Gaussian per element-bound endpoint) and raw Points are arithmetically adjusted (no extra RNG). Seeded sessions that previously triggered no scroll and now do will see different downstream cursor coordinates; action outcomes (mousedown / mouseup positions, target elements) are unchanged.

  ## Skipped automatically

  - `speed: 'instant'` (whole humanized drag path is bypassed).
  - Both endpoints raw `Point` with curve overflow — there's no scroll position that helps, since shifting both points by the scroll delta just lengthens the drag in the new viewport.

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

- Updated dependencies [5313f46]
- Updated dependencies [ce172e2]
- Updated dependencies [94f13b3]
- Updated dependencies [87bbb59]
  - @humanjs/core@0.5.0

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
