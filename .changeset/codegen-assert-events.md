---
"@humanjs/playwright": minor
---

`generatePlaywrightTest` now renders explicit `assert` timeline events into `@playwright/test` assertions: `{ kind: 'visible' }` → `expect(locator).toBeVisible()`, `{ kind: 'text', value }` → `toHaveText(value)`, `{ kind: 'url', value }` → `expect(page).toHaveURL(value)`. They interleave with actions in recorded order and pull `page` + `expect` into the test automatically. The standalone `generateHumanJS` script export ignores them (a replay script has no `expect`). This lets tooling that builds a `Timeline` (notably `@humanjs/generator`) emit intentional assertions alongside the actions, beyond the ones already derived from reads and captured inputs.
