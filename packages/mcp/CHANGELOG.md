# @humanjs/mcp

## 0.4.0

### Minor Changes

- 13ca334: Add `human.selectText(target, options?)` — highlight text inside an element. The cursor moves to the element (humanized), then the text is selected — the "select this" gesture before copying, replacing, or triggering a highlight menu. Selects the element's whole text by default; pass `{ text }` to select just that substring, located inside the element whitespace-tolerantly and mapped to exact offsets (first match, falling back to the whole element if not found) — so it's reproduced by the text itself, not brittle coordinates. In `speed: 'instant'` the cursor motion is skipped; the selection is still applied.

  Mirrored as the **`human_selectText`** MCP tool (with the optional `text` arg), rendered by the recorder code generators (`toPlaywright` / `toHumanJS`), documented in the `@humanjs/skill` primitives table, and backed by a new `'selectText'` `KnownActionType` in `@humanjs/core`. `@humanjs/generator` captures the gesture too: highlighting an element's whole text records a plain `selectText`, and highlighting part of it records `selectText(target, { text })` with the exact substring.

### Patch Changes

- Updated dependencies [39d87f3]
- Updated dependencies [39d87f3]
- Updated dependencies [39d87f3]
- Updated dependencies [13ca334]
  - @humanjs/playwright@0.9.0
  - @humanjs/core@0.8.0
  - @humanjs/recorder@0.3.2

## 0.3.0

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

### Patch Changes

- 8857b00: Ship the MIT `LICENSE` file inside every package tarball. Each package listed `LICENSE` in its `files` array but had no license file in its own directory, so published tarballs omitted it — this adds the file to each package. Also broadens every package's npm keywords for discoverability.

  Tooling (not published): a `check:exports` task runs `publint --strict` on every package in CI, validating the published exports map, `files`, and type fields against the packed output (warnings fail the check).

- Updated dependencies [a0a11c4]
- Updated dependencies [910260f]
- Updated dependencies [8857b00]
- Updated dependencies [4757040]
- Updated dependencies [54b3c65]
- Updated dependencies [f77ca93]
  - @humanjs/playwright@0.8.0
  - @humanjs/core@0.7.0
  - @humanjs/recorder@0.3.1

## 0.2.0

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
  - @humanjs/recorder@0.3.0

## 0.1.0

### Minor Changes

- 4de26ba: Initial release of `@humanjs/mcp` — a Model Context Protocol server that lets AI agents (Claude Desktop, Claude Code, Cursor, Codex, Cline, …) drive a Playwright browser with humanized motion, typing, and reading dwell.

  It's "Playwright MCP, but humanized": same stdio protocol every desktop AI client speaks, except every action moves like a person and the cursor is visible (so recordings and live demos look real).

  Configure it in your MCP client:

  ```jsonc
  {
    "mcpServers": {
      "humanjs": {
        "command": "npx",
        "args": ["-y", "@humanjs/mcp"],
        "env": { "HUMANJS_PERSONALITY": "careful" }
      }
    }
  }
  ```

  Requires Node ≥ 20. The `playwright` npm package is bundled, and the Chromium browser binary downloads automatically on first launch if it's missing (~150MB, one time) — so `npx -y @humanjs/mcp` works with zero manual setup. Set `HUMANJS_AUTO_INSTALL=false` to opt out and install manually with `npx playwright install chromium`.

  The server also ships **built-in agent guidance** (MCP `instructions`): explore selectors first, then dispatch a known run as a single batch of tool calls in one turn (so actions fire back-to-back instead of with a model-inference pause — slow in general, dead air in a recording), and prefer specific role/aria-label selectors on dynamic lists — so natural-looking recordings don't need the user to spell out the workflow.

  ## Tools (27)

  - **Primitives** — `human_goto`, `human_click`, `human_rightClick`, `human_hover`, `human_move`, `human_drag`, `human_type`, `human_paste`, `human_press`, `human_scroll`, `human_read`. Click / rightClick / move / drag accept a selector **or** raw x/y coordinates (the fallback for icon-only buttons, canvas, SVG you can see in a screenshot).
  - **Inspection** — `human_screenshot` (returns the image to view, optionally saves it), `human_page_text`, `human_get_text`, `human_get_attribute`, `human_get_html`. Enough to act + observe with one server; no Playwright MCP needed alongside.
  - **Recording** — `human_start_recording` / `human_stop_recording`. Capture the session and export to one or more of mp4 / webm / gif / JSON timeline in a single stop (e.g. video + timeline from one recording); the visible cursor is in the video.
  - **Sessions** — `human_create_session` (optional personality + speed + viewport), `human_close_session`, `human_list_sessions`. The default session is implicit; these are only for parallel browsers.
  - **Config** — `human_set_personality` (switch preset or blend at runtime), `human_set_speed` (humanization pace), `human_set_viewport` (resize the live viewport).
  - **Browser** — `human_browser_info` (report mode/channel/persistence), `human_enable_persistence` (persistent profile, optional restart-now), `human_restart_browser` (apply a change or recover).

  ## Environment

  - `HUMANJS_PERSONALITY` — default personality (`careful` | `fast` | `distracted` | `precise`). Default `careful`.
  - `HUMANJS_SPEED` — humanization pace (`human` | `fast` | `instant`). Default `human`.
  - `HUMANJS_HEADLESS` — `true` for headless. Default `false` (visible browser — the point of the MCP).
  - `HUMANJS_OUTPUT_DIR` — where screenshots / recordings are written. Default: the server's working directory.
  - `HUMANJS_VIEWPORT` — default viewport `WIDTHxHEIGHT` for new sessions. Default `1440x900`.
  - `HUMANJS_PERSIST` — persist a profile across runs (logins survive). Default `false`.
  - `HUMANJS_USER_DATA_DIR` — explicit persistent profile directory.
  - `HUMANJS_CDP_URL` — attach to an already-running browser over CDP (your real logins/tabs).
  - `HUMANJS_CHANNEL` — launch an installed browser (`chrome`, `msedge`, …) instead of bundled Chromium.

  ## Browser modes

  Default is a fresh, isolated browser each run. Opt into a persistent profile (`HUMANJS_PERSIST` / `HUMANJS_USER_DATA_DIR`) to keep logins across runs, or attach to your already-running browser (`HUMANJS_CDP_URL`) to use its real sessions. `HUMANJS_CHANNEL=chrome` alone only swaps the binary — it does **not** reuse your profile. Persistent/CDP modes drive a single shared browser (no parallel sessions). Persistence is also togglable from chat (`human_enable_persistence` + `human_restart_browser`); attaching to your real browser stays env-only by design.

  ## Security

  No arbitrary-JS `evaluate` tool — that's a prompt-injection cliff (a malicious page could trick an agent into running JS that exfiltrates data). The read-only inspection tools cover the legitimate need. File-producing tools accept a basename only; path components are rejected so a prompt-injected filename can't escape `HUMANJS_OUTPUT_DIR`.

### Patch Changes

- Updated dependencies [4de26ba]
- Updated dependencies [4de26ba]
- Updated dependencies [eba9ebd]
  - @humanjs/playwright@0.6.0
  - @humanjs/core@0.6.0
  - @humanjs/recorder@0.2.0
