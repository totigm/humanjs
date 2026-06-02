---
"@humanjs/playwright": minor
"@humanjs/mcp": minor
"@humanjs/core": minor
"@humanjs/skill": patch
---

Add `human.clear(target)` — clears a text field (input / textarea / contenteditable) with a real humanized keyboard gesture: click to focus, **select-all**, a beat, then **delete**, firing the `input` events the page expects. Pair it with `type()` to replace an existing value rather than append to it. In `speed: 'instant'` it delegates to Playwright's native `locator.clear()`.

Mirrored as the **`human_clear`** MCP tool, exported by the recorder code generators (`toPlaywright` / `toHumanJS`), documented in the `@humanjs/skill` primitives table, and backed by a new `'clear'` `KnownActionType` in `@humanjs/core`.
