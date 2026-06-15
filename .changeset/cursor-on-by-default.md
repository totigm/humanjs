---
"@humanjs/playwright": minor
---

`createHuman` now installs the visual cursor overlay (`installMouseHelper`) **by default**, so humanized motion is visible in headed runs and recordings without a manual call — exported scripts from `@humanjs/generator` / `Recording.toHumanJS()` now show the cursor when you run them.

Opt out with `cursor: false` — do this for `speed: 'instant'` / CI, where there's no motion to show and the injected cursor would otherwise land in test DOM and screenshots. Pass an options object (`cursor: { color, size, … }`) to style it. The `@humanjs/playwright/test` fixture opts out automatically in CI (it already runs `instant` there) and shows the cursor on local runs.

The install is scoped to the session's page, idempotent (a manual `installMouseHelper` or the MCP server's install on top is a no-op), and skipped on page objects that don't support it (so unit-test mocks are unaffected).
