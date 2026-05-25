---
"@humanjs/playwright": minor
---

`human.type()` now clicks the target before typing in humanized speed modes (`'human'` and `'fast'`).

Previously, `human.type(selector, value)` called `locator.focus()` directly — a programmatic focus with no cursor motion. A real user doesn't teleport-focus a field; they move their cursor to it and click. The new behavior moves the cursor along a Bezier path to the input, clicks it (which triggers a real focus event via the click), then types.

```ts
await human.type('#email', 'demo@humanjs.dev');
//  → cursor moves to #email
//  → click event fires (focuses the input naturally)
//  → typing proceeds with realistic per-key rhythm
```

The implicit click is a sub-step of the type action — **not** its own timeline event. `human.type()` still emits exactly one `'type'` event, the same way `human.click()` already does an implicit hover-before-click motion without emitting a separate `'hover'` event. This keeps timelines compact and the `toHumanJS()` exporter round-trip clean: `[type]` → `human.type(s, v)` → click+type on replay.

**Skipped when:**

- `speed: 'instant'` — the whole point of instant mode is to bypass humanization for fast CI runs.
- The value is empty — no typing to set up, no click needed.

**Migration**: code that called `human.type(selector, value)` and depended on the cursor staying put will see the cursor move to the input. To opt out of cursor motion entirely for a typing action, use `speed: 'instant'` (bypasses all humanization) or call `page.locator(selector).fill(value)` directly — `@humanjs/playwright` re-exports the Playwright primitives, so no second import is needed.
