---
"@humanjs/playwright": minor
"@humanjs/mcp": minor
"@humanjs/skill": patch
---

Add page perception for AI agents: `human.outline(target?)` returns the page's accessibility-tree outline (every interactive element and landmark by ARIA role + accessible name, as compact YAML — Playwright's `ariaSnapshot`). It's the token-efficient way for an agent to see what's actionable and pick a selector: the names map directly to `getByRole` / accessible-name selectors, which HumanJS already favors. Pass a `target` to scope it to a region.

Exposed over MCP as **`human_outline`** (inspection tool, alongside `human_page_text` / `human_get_html`), and documented in the `@humanjs/skill` selector-strategy guide.

`@humanjs/playwright`'s `playwright` peer dependency floor moves from `>=1.40.0` to `>=1.49.0` — the version where `ariaSnapshot` landed.
