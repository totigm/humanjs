---
"@humanjs/playwright": minor
"@humanjs/core": minor
"@humanjs/mcp": minor
"@humanjs/generator": patch
"@humanjs/skill": patch
---

Add `human.selectText(target, options?)` — highlight text inside an element. The cursor moves to the element (humanized), then the text is selected — the "select this" gesture before copying, replacing, or triggering a highlight menu. Selects the element's whole text by default; pass `{ text }` to select just that substring, located inside the element whitespace-tolerantly and mapped to exact offsets (first match, falling back to the whole element if not found) — so it's reproduced by the text itself, not brittle coordinates. In `speed: 'instant'` the cursor motion is skipped; the selection is still applied.

Mirrored as the **`human_selectText`** MCP tool (with the optional `text` arg), rendered by the recorder code generators (`toPlaywright` / `toHumanJS`), documented in the `@humanjs/skill` primitives table, and backed by a new `'selectText'` `KnownActionType` in `@humanjs/core`. `@humanjs/generator` captures the gesture too: highlighting an element's whole text records a plain `selectText`, and highlighting part of it records `selectText(target, { text })` with the exact substring.
