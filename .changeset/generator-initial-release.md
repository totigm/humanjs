---
"@humanjs/generator": minor
---

Initial release of `@humanjs/generator` — a visual recorder that turns a real browsing session into a clean, humanized Playwright test.

`npx @humanjs/generator <url>` opens a real Chromium window and a local (loopback-only) dashboard. As you click, type, scroll, drag, and navigate, each action streams into the dashboard as a step captured with a role-first selector (ARIA role + accessible name → label → text → test id → `#id` → CSS → XPath). The dashboard is a full editor:

- **drag to reorder**, delete, relabel (label → comment), and edit captured values
- a per-step **selector picker** over the ranked candidates
- **point-and-add assertions** (`toBeVisible` / `toHaveText` / `toHaveURL`)
- a **secret toggle** that exports a value as `process.env.X` instead of a literal (passwords are always masked)
- a **personality switcher** (`careful` / `fast` / `distracted` / `precise`)
- a live, syntax-highlighted code preview that updates on every edit

Export a `@humanjs/playwright/test` spec (`.spec.ts` / `.test.ts`) or a standalone HumanJS script (`.ts`). The curated timeline runs through `@humanjs/playwright`'s codegen, so generated specs stay in lockstep with the library. Requires Node ≥ 20 and the Playwright Chromium browser (`npx playwright install chromium`).
