# @humanjs/generator

## 0.2.0

### Minor Changes

- 3e5ab52: Add `replayTimeline(page, timeline, options?)` — replay a recorded `Timeline` against a live page, driving it through the same humanized primitives the exported test uses. Runs each event in order, reports per-step pass/fail via an `onStep` callback, and **stops at the first failure** (like a real test). `assert` events are evaluated with plain Playwright APIs (no `@playwright/test` dependency). Supports an `AbortSignal` to cancel an in-flight run, and resolves with a `ReplayResult` (`status`, per-step results, `failedIndex`, `durationMs`). Defaults to `speed: 'human'` with the cursor on, so the replay is watchable.

  `@humanjs/generator` uses it to power a new **Run** button in the dashboard: replay the curated recording in a fresh, capture-free window and see each step go green or red live, with an overall pass/fail banner — closing the record → edit → verify loop. The run is cancellable and never re-records itself.

### Patch Changes

- Updated dependencies [3e5ab52]
  - @humanjs/playwright@0.10.0

## 0.1.0

### Minor Changes

- 39d87f3: Initial release of `@humanjs/generator` — a visual recorder that turns a real browsing session into a clean, humanized Playwright test.

  `npx @humanjs/generator <url>` opens a real Chromium window and a local (loopback-only) dashboard. As you click, type, scroll, drag, select text, and navigate, each action streams into the dashboard as a step captured with a role-first selector (ARIA role + accessible name → label → text → test id → `#id` → CSS → XPath). The dashboard is a full editor:

  - **drag to reorder**, delete, relabel (label → comment), and edit captured values
  - a per-step **selector picker** over the ranked candidates
  - **point-and-add assertions** (`toBeVisible` / `toHaveText` / `toHaveURL`)
  - a **secret toggle** that exports a value as `process.env.X` instead of a literal (passwords are always masked)
  - a **personality switcher** (`careful` / `fast` / `distracted` / `precise`)
  - a live, syntax-highlighted code preview that updates on every edit

  Export a `@humanjs/playwright/test` spec (`.spec.ts` / `.test.ts`) or a standalone HumanJS script (`.ts`). The curated timeline runs through `@humanjs/playwright`'s codegen, so generated specs stay in lockstep with the library. Requires Node ≥ 20 and the Playwright Chromium browser (`npx playwright install chromium`).

### Patch Changes

- 13ca334: Add `human.selectText(target, options?)` — highlight text inside an element. The cursor moves to the element (humanized), then the text is selected — the "select this" gesture before copying, replacing, or triggering a highlight menu. Selects the element's whole text by default; pass `{ text }` to select just that substring, located inside the element whitespace-tolerantly and mapped to exact offsets (first match, falling back to the whole element if not found) — so it's reproduced by the text itself, not brittle coordinates. In `speed: 'instant'` the cursor motion is skipped; the selection is still applied.

  Mirrored as the **`human_selectText`** MCP tool (with the optional `text` arg), rendered by the recorder code generators (`toPlaywright` / `toHumanJS`), documented in the `@humanjs/skill` primitives table, and backed by a new `'selectText'` `KnownActionType` in `@humanjs/core`. `@humanjs/generator` captures the gesture too: highlighting an element's whole text records a plain `selectText`, and highlighting part of it records `selectText(target, { text })` with the exact substring.

- Updated dependencies [39d87f3]
- Updated dependencies [39d87f3]
- Updated dependencies [39d87f3]
- Updated dependencies [13ca334]
  - @humanjs/playwright@0.9.0
  - @humanjs/core@0.8.0
