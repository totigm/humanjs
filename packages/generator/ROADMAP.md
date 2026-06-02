# @humanjs/generator — roadmap

Tracks what ships in the first release and what's deliberately deferred. Vision lives in [`docs/DESIGN.md`](../../docs/DESIGN.md#generator-humanjsgenerator-v2); this file is the execution plan.

## v0.1 (in progress)

The first published release. Milestones, each independently testable:

1. **Scaffold** — package shell (mirrors `@humanjs/mcp`) + additive `generateHumanJS` / `generatePlaywrightTest` export from `@humanjs/playwright`. _(done)_
2. **CLI + browser launch + local server** — `npx @humanjs/generator <url>` opens a real Chromium window and a localhost-only dashboard (HTTP + WebSocket) that reports "connected". _(done)_
3. **Capture + ranked selector inference** — an injected content script records click / type / scroll / navigation as `TimelineEvent`s and streams them live. `selectors.ts` ranks candidates (ARIA role + accessible name → label → text → test id → CSS → XPath) and is unit-tested against a fixture DOM. _(done)_
4. **Export layer** — curated `Timeline` → `.spec.ts` / `.ts` via the shared codegen, including **assertion rendering** and **secret → `process.env.*` substitution**. e2e: record a fixture flow, export, run the generated spec. _(done)_ The placeholder dashboard now shows a live code preview and Export buttons; the codegen learned to render explicit `assert` events (`@humanjs/playwright`).
5. **Full editor UI** (Vite + React SPA, bundled into the package):
   - delete / reorder / relabel steps, edit captured text
   - per-step **selector picker** (choose among ranked candidates)
   - **point-and-add assertions** (`toBeVisible` / `toHaveText` / `toHaveURL`)
   - **secret-field toggle** (emit `process.env.X` + a "set this" note)
   - **personality switcher** (`careful` / `fast` / `distracted` / `precise`)
   - **live code preview** — regenerated on every timeline mutation
6. **Polish + README + DESIGN cross-link**, then a `minor` changeset to publish `0.1.0`.

## v0.2+ (deferred follow-ups)

Each adds a real subsystem, so they stay out of the first cut:

- **In-app replay / verify** — a "run this" button that executes the exported spec (spawns `playwright test`) and shows pass / fail in the dashboard, closing the record → test → green loop.
- **Video + GIF export** — capture frames alongside the DOM events so the same session also exports an `.mp4` / `.gif` via the existing `toVideo` / `toGif` path. Reuses recorder infra; great for the demo / tutorial-creator audience. Needs the frame-capture loop running next to DOM capture.
- **Insert / re-record mid-timeline** — append or splice new actions into an existing recording without starting over.
- **`human.selectText(target)` primitive + capture** — a combined unit done together: add the element-scoped text-selection primitive to `@humanjs/core` + `@humanjs/playwright` (wrapping Playwright's `locator.selectText()`) + the MCP tool + codegen support + a changeset, **and** the small recorder.ts wiring to capture it. Scope: **element-scoped only** (anchor + focus inside one element covering its text). Free-form cross-element range selection stays uncaptured by design — it's offset/coordinate-based and would generate a brittle, reflow-fragile step, against HumanJS's selectors-over-coordinates philosophy. Until then, the recorder's text-selection guard correctly keeps highlighting from producing a bogus `drag`.

## Deliberately out of scope

- **LLM-named selectors / AI step descriptions** — the role + accessible-name inference is sufficient and adds no API-key dependency or per-run cost.
- **MCP tool surface** — the generator is a CLI dev-tool, not a runtime primitive an agent composes; per the repo's "consider the MCP surface" rule, it intentionally ships no MCP tools.
- Anything framed around stealth, fingerprint masking, proxy rotation, captcha bypass, or "undetectable" automation — these are project-wide [non-goals](../../CLAUDE.md).
