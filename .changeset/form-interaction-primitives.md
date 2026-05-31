---
"@humanjs/playwright": minor
"@humanjs/mcp": minor
"@humanjs/core": minor
"@humanjs/skill": patch
---

Add form-interaction primitives so real flows (forms, checkout, settings) stay fully humanized instead of dropping back to raw Playwright:

- **`human.doubleClick(target)`** — same humanized approach as `click()`, double-click dispatch.
- **`human.check(target)` / `human.uncheck(target)`** — tick/untick a checkbox or radio; clicks only when the state needs to change (a real user doesn't re-click an already-ticked box), and verifies the result.
- **`human.selectOption(target, values)`** — choose option(s) in a native `<select>`; the cursor moves to the dropdown, then the value is set (firing `input`/`change`).
- **`human.upload(target, files)`** — attach file(s) to a file input; the cursor moves to the control, then files are set directly (never opens the OS dialog).

Each is mirrored as an MCP tool (`human_doubleClick`, `human_check`, `human_uncheck`, `human_selectOption`, `human_upload`), exported by the recorder's code generators (`toPlaywright` / `toHumanJS`), and documented in the `@humanjs/skill` primitives reference. `@humanjs/core` gains the matching `KnownActionType` entries so plugins can observe them.
