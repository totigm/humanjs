---
"@humanjs/playwright": minor
"@humanjs/generator": minor
---

Add `replayTimeline(page, timeline, options?)` — replay a recorded `Timeline` against a live page, driving it through the same humanized primitives the exported test uses. Runs each event in order, reports per-step pass/fail via an `onStep` callback, and **stops at the first failure** (like a real test). `assert` events are evaluated with plain Playwright APIs (no `@playwright/test` dependency). Supports an `AbortSignal` to cancel an in-flight run, and resolves with a `ReplayResult` (`status`, per-step results, `failedIndex`, `durationMs`). Defaults to `speed: 'human'` with the cursor on, so the replay is watchable.

`@humanjs/generator` uses it to power a new **Run** button in the dashboard: replay the curated recording in a fresh, capture-free window and see each step go green or red live, with an overall pass/fail banner — closing the record → edit → verify loop. The run is cancellable and never re-records itself.
