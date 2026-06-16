---
"@humanjs/playwright": minor
"@humanjs/core": minor
"@humanjs/mcp": minor
"@humanjs/skill": patch
---

Add `human.selectText(target)` — highlight all the text inside an element. The cursor moves to the element (humanized), then its text is selected — the "select this" gesture before copying, replacing, or triggering a highlight menu. Element-scoped: it selects the element's whole text, not a free-form range across the page. In `speed: 'instant'` it delegates to Playwright's native `locator.selectText()` with no motion.

Mirrored as the **`human_selectText`** MCP tool, rendered by the recorder code generators (`toPlaywright` / `toHumanJS`), documented in the `@humanjs/skill` primitives table, and backed by a new `'selectText'` `KnownActionType` in `@humanjs/core`. `@humanjs/generator` captures the gesture too: a triple-click, select-all, or drag that covers an element's whole text is recorded as a `selectText` step (free-form cross-element ranges are intentionally not captured).
