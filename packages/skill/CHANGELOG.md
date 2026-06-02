# @humanjs/skill

## 0.2.0

### Minor Changes

- 7380437: Add a `--global` / `-g` flag to install the skill for every project instead of the current one. Claude Code goes to `~/.claude/skills/humanjs/SKILL.md` and Codex to `~/.codex/AGENTS.md` (merged in place, never clobbered). Cursor has no global rules file, so it's skipped with guidance to install per-project or paste into Cursor's user-rules settings. Combine with target flags (e.g. `npx @humanjs/skill -g --claude`) or run `npx @humanjs/skill --global` to pick interactively.

### Patch Changes

- a0a11c4: Add form-interaction primitives so real flows (forms, checkout, settings) stay fully humanized instead of dropping back to raw Playwright:

  - **`human.doubleClick(target)`** — same humanized approach as `click()`, double-click dispatch.
  - **`human.check(target)` / `human.uncheck(target)`** — tick/untick a checkbox or radio; clicks only when the state needs to change (a real user doesn't re-click an already-ticked box), and verifies the result.
  - **`human.selectOption(target, values)`** — choose option(s) in a native `<select>`; the cursor moves to the dropdown, then the value is set (firing `input`/`change`).
  - **`human.upload(target, files)`** — attach file(s) to a file input; the cursor moves to the control, then files are set directly (never opens the OS dialog).

  Each is mirrored as an MCP tool (`human_doubleClick`, `human_check`, `human_uncheck`, `human_selectOption`, `human_upload`), exported by the recorder's code generators (`toPlaywright` / `toHumanJS`), and documented in the `@humanjs/skill` primitives reference. `@humanjs/core` gains the matching `KnownActionType` entries so plugins can observe them.

  `human_upload` confines reads to `HUMANJS_UPLOAD_DIR` (default: the server's working dir) and accepts a basename only — `../`, subdirectories, and absolute paths are rejected — so a prompt-injected filename can't read and exfiltrate arbitrary local files to a web form (same path-safety model as the output tools).

- 910260f: Add `human.clear(target)` — clears a text field (input / textarea / contenteditable) with a real humanized keyboard gesture: click to focus, **select-all**, a beat, then **delete**, firing the `input` events the page expects. Pair it with `type()` to replace an existing value rather than append to it. In `speed: 'instant'` it delegates to Playwright's native `locator.clear()`.

  Mirrored as the **`human_clear`** MCP tool, exported by the recorder code generators (`toPlaywright` / `toHumanJS`), documented in the `@humanjs/skill` primitives table, and backed by a new `'clear'` `KnownActionType` in `@humanjs/core`.

- 8857b00: Ship the MIT `LICENSE` file inside every package tarball. Each package listed `LICENSE` in its `files` array but had no license file in its own directory, so published tarballs omitted it — this adds the file to each package. Also broadens every package's npm keywords for discoverability.

  Tooling (not published): a `check:exports` task runs `publint --strict` on every package in CI, validating the published exports map, `files`, and type fields against the packed output (warnings fail the check).

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

## 0.1.0

### Minor Changes

- c290b44: Initial release of `@humanjs/skill` — a one-command installer that teaches AI coding assistants to write humanized HumanJS automation.

  `npx @humanjs/skill` drops the HumanJS skill into your project for **Claude Code** (`.claude/skills/humanjs/SKILL.md`), **Cursor** (`.cursor/rules/humanjs.mdc`), and/or **Codex** (root `AGENTS.md`, merged in place via markers — never clobbered). With no flags it prompts which tools to set up; `--claude` / `--cursor` / `--codex` / `--all` pick non-interactively (and CI / non-TTY use requires flags rather than hanging on a prompt).

  Distinct from `@humanjs/mcp`: the MCP server lets an agent _drive_ a humanized browser; this skill teaches a coding agent to _write_ HumanJS code.
