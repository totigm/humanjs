# HumanJS

Humanized browser automation for AI agents, QA tests, and demos. Playwright-first.

> This file is the brief loaded into every Claude session in this repo. Keep it lean.
> Architectural reasoning lives in [`docs/DESIGN.md`](./docs/DESIGN.md) (public). Strategic and personal notes live in `docs/PROJECT_BRIEF.md` (local-only, gitignored).

## Project status

Greenfield — no code yet. We're scaffolding the v1 monorepo from scratch.

## Positioning (immutable)

**HumanJS humanizes browser automation for AI agents, QA tests where real-pace timing exposes bugs, and demo/tutorial recordings.**

When writing copy, docs, examples, or comments: never frame the project around scraping, captcha bypass, or "undetectable" automation. The audience is AI agent builders, QA engineers, and demo/tutorial creators.

## Non-goals — refuse to implement

If asked, decline and link to this section.

- Captcha solvers / captcha bypass
- Fingerprint masking or browser fingerprint spoofing
- Proxy rotation or IP management
- TLS / network-level stealth
- "Undetectable" claims anywhere in any artifact
- Time-of-day variation (gimmick, no real value)
- AI-generated mouse trajectories (worse than Bezier, vastly more expensive)

## Naming

- **Brand**: HumanJS
- **Primary npm scope**: `@humanjs/*`
- **Fallback scope**: `@totigm/humanjs` (used only if `@humanjs` org isn't claimable on first publish)
- **Domain**: humanjs.dev (planned)

Verified available on npm at project start: `@humanjs/core`, `@humanjs/playwright`, `@humanjs/recorder`, `@humanjs/mcp`, `@humanjs/generator`, `@humanjs/skill`, `@humanjs/recipes`. Unscoped `humanjs` is owned by a dormant 2022 package — irrelevant scope, doesn't block us.

## Architecture

- **Monorepo** (pnpm workspaces, optionally Turborepo). Each package independently versioned.
- **Playwright-first.** Puppeteer adapter is roadmap, not v1.
- **Plugin system from day one.** Even if v1 ships no plugins, the architecture supports extending personalities, primitives, and behaviors via plugins. Non-negotiable architectural decision.
- **TypeScript strict.** ESM-first with CJS dual-publish where needed.
- **MIT licensed.**

## Packages

| Package | Purpose | Tier |
|---|---|---|
| `@humanjs/core` | Personality system, timing math, types, plugin contract | v1 |
| `@humanjs/playwright` | Playwright adapter — the main public API | v1 |
| `@humanjs/recorder` | Session recording → mp4 / Playwright code / JSON | v1 |
| `@humanjs/mcp` | MCP server for runtime AI agents | v1 |
| `@humanjs/skill` | Anthropic / Cursor / Codex skill for AI coding agents | v1 |
| `@humanjs/generator` | `npx @humanjs/generator <url>` — visual recorder UI | v2 |
| `@humanjs/recipes` | Pre-built common flows (login, checkout, etc.) | v2 |
| `@humanjs/puppeteer` | Puppeteer adapter | v3 |

## Public API shape — keep examples consistent with this

```ts
import { createHuman, blend } from '@humanjs/playwright';

const human = await createHuman(page, {
  personality: 'careful',  // careful | fast | distracted | precise | custom
  seed: 'optional-seed',   // deterministic when set
  speed: 'human',          // human | fast | instant
  plugins: [],             // optional plugins
});

await human.goto(url);
await human.click(selector);              // hover, micro-move, click
await human.rightClick(selector);         // context-menu click
await human.doubleClick(selector);        // same motion as click; double-click dispatch
await human.hover(selector);              // hover without clicking
await human.move(target);                 // selector | Locator | Point — positional, no settle dwell
await human.drag(from, to);               // each endpoint: selector | Locator | Point
await human.type(selector, value);        // click, then realistic typing rhythm
await human.paste(selector, value);       // Cmd-V style (no per-char timing)
await human.clear(selector);              // wipe a field: select-all + delete (pair with type to replace)
await human.check(selector);              // tick a checkbox/radio (clicks only if needed)
await human.uncheck(selector);            // untick a checkbox
await human.selectOption(selector, value);// native <select> — cursor moves to it, then sets value
await human.selectText(selector);         // highlight an element's text (cursor moves to it, then selects)
await human.upload(selector, files);      // attach file(s) to a file input (no OS dialog)
await human.read(text);                   // dwell based on word count
await human.scroll('natural');
await human.press('Mod+S');               // chord — 'Mod' auto-maps: Meta on Mac, Control elsewhere
await human.press('Tab');                  // bare key — single keys work too

const rec = await human.record(async () => { /* actions */ });
await rec.toVideo('out.mp4');                // shipped
await rec.toGif('out.gif');                   // shipped
await rec.toTimeline('session.json');         // shipped
// await rec.toPlaywright('test.spec.ts');    // v0.2 — Playwright code export

await sleep(800);                             // shared helper, re-exported from @humanjs/core
```

Selector strategy: prefer accessible names + roles. Default to `getByRole`, `getByLabel`, `getByText` before falling back to CSS / XPath. This is also a humanization signal — real users navigate by what they see.

## Personalities

Layered API:

```ts
// 1. Preset
{ personality: 'careful' }

// 2. Preset + overrides
{ personality: { extends: 'careful', typing: { typoProbability: 0.1 } } }

// 3. Fully custom
{ personality: { speed, mouse, typing, reading, dwell } }

// 4. Composition
{ personality: blend('careful', 'distracted', 0.3) }

// 5. Community-published
import { grandma } from '@yourname/personality-grandma';
{ personality: grandma }
```

The `Personality` type is **publicly exported and stable** from `@humanjs/core`. Community can ship `@anything/personality-*` packages.

Built-in presets: `careful`, `fast`, `distracted`, `precise`. **Do not add more presets without strong justification.** Depth over breadth.

## Determinism

Every personality output is deterministic given a seed. `{ seed: 'foo' }` produces identical trajectories every run. Required for snapshot tests. Implement with a seeded PRNG (e.g. `seedrandom`) threaded through every random call.

## CI mode

`{ speed: 'instant' }` bypasses all humanization (straight Playwright). Tests stay fast. Local dev gets the full human treatment. Default: `'human'`.

Recommended pattern in tests:

```ts
const human = await createHuman(page, {
  speed: process.env.CI ? 'instant' : 'human',
  seed: test.info().title,
});
```

## v1 must-have features

Don't ship core packages without these:

- Mouse: click, move, scroll (Bezier paths — leverage ghost-cursor's `path()` under the hood; MIT-compatible)
- Typing with realistic rhythm + optional typo simulation + backspace recovery
- Reading dwell (`human.read(text)`)
- Personalities (4 presets + extend/override/blend)
- Seedable randomness
- Speed multiplier / instant mode
- Hover-before-click
- Misclick + recovery
- Action descriptions (structured event per action — for AI agent observability)
- Session recorder (→ mp4 / Playwright code / JSON)
- Visual overlay (modernized `installMouseHelper`)
- Plugin system contract (interface exists even with no plugins shipped)
- AI agent integration: MCP server, plus Claude/Cursor/Codex skill

## Honest limits — state in README, never hide

- Will not defeat sophisticated bot detection (fingerprinting, TLS, request patterns)
- Slows test runs at default speed (use `speed: 'instant'` in CI)
- Playwright-first; Puppeteer / Selenium not in v1
- Adds humanization on top of Playwright; doesn't replace it

## Marketing voice

- **Audience**: AI agent builders, QA engineers, demo/tutorial creators. Never scrapers.
- **Hero asset**: a 30-second side-by-side video (robotic Playwright vs HumanJS). Every marketing surface links to it.
- **Voice**: confident, cinematic, honest. **Not** the ghost-cursor "definitely-not-robot" wink.
- **Comparison rule**: respect ghost-cursor. Different scope, not "we're better."
- **Skeptic question** ("why humanize AI agents?"): always answer with the 5 legitimate use cases — see PROJECT_BRIEF.md "The 'why humanize' answer" section.

## Release hygiene — update the landing after every version bump

When the changesets-generated "Version Packages" PR merges to `main` (and the release workflow publishes to npm), the landing page and root README hold hard-coded version references that go stale. **Update them in the same commit cycle as the release, not "later."**

Files to touch on every minor/major bump of `@humanjs/playwright` (the user-facing flagship):

- `apps/web/components/sections/Hero.tsx` — the eyebrow line `<span className="text-accent">vX.Y</span>`
- `apps/web/components/sections/HonestLimits.tsx` — the `latest vX.Y` line in the Designed Scope block
- `apps/web/components/sections/TrustStrip.tsx` — the `Latest` signal's `value: '@humanjs/core@X.Y.Z'`
- `README.md` — any sample/comment code blocks that reference shipped vs upcoming versions

Wording rules:

- **Use durable phrasing.** Write `latest vX.Y`, not `vX.Y ships today` — "today" rots the day after release.
- **Pin only one version per surface.** TrustStrip's "Latest" pill is currently `@humanjs/core@X.Y.Z`. Don't add parallel `@humanjs/playwright@X.Y.Z` / `@humanjs/recorder@X.Y.Z` pills — the user only needs one anchor; the rest live in the README.
- **No version-style strings in mock/demo data.** Tags like `v0.9` or `v1.0` inside changelog-style demos (e.g. `apps/web/components/motion/ScrollDemo.tsx`) will be misread as real version claims. Use categorical labels — `SHIPPED`, `NOTE`, `DESIGN`.

Check before commit: `grep -rn "v0\.\|@humanjs/.*@0\." apps/web/components apps/web/app README.md packages/*/README.md` — should return only the just-bumped current values, no older references.

## Adding new features — consider the MCP surface

When adding a new public-API primitive or behavior to `@humanjs/playwright` or `@humanjs/core`, evaluate whether it should also be exposed as an `@humanjs/mcp` tool. The MCP tool surface should mirror the library's user-facing primitives so AI agents get parity with library users — otherwise we ship a half-feature split between the two adapters.

Skip MCP exposure for:

- Internal plugin hooks and observability machinery (not useful to an AI).
- Anything whose public-API shape requires composing async callbacks (those need to be reshaped into start/stop tool pairs, not 1:1 tools — `record()` is the canonical example).
- Features that require a security-cliff capability the MCP surface deliberately doesn't expose (e.g., arbitrary JS execution — see `@humanjs/mcp` README for the inspection-tool alternatives).

If you ship a primitive in `@humanjs/playwright` without the matching MCP tool, open a follow-up issue immediately so the gap doesn't get forgotten.

## Adding a new package

When scaffolding a new `@humanjs/*` package, mirror an existing one (`packages/recorder` is a good template) and follow these — each bit us at least once:

- Start `package.json` at `"version": "0.0.0"` and set `"publishConfig": { "access": "public" }`. The first changeset (`minor`) publishes it as `0.1.0`.
- Copy the sibling's `tsconfig.json` + `tsup.config.ts` and the standard `package.json` shape (`exports`/`main`/`module`/`types`, `files: ["dist", "README.md", "LICENSE"]`, `engines`, the build/test/typecheck/lint scripts).
- Open the README with the badge row (npm version · downloads · GitHub repo · CI · license · docs) — copy from any package README and swap the name.
- Add a changeset describing the initial release.
- **Library packages** declare runtime deps as `peerDependencies` (the host app provides them). A **runnable/bin package** (`npx`-launched, like `@humanjs/mcp`) needs them as regular `dependencies` instead — there's no host app to supply a peer.
- Update the Packages table above, and apply the "consider the MCP surface" rule.

## Conventions

- TypeScript strict. No `any` without an inline comment justifying it.
- ESM-first; dual-publish CJS where needed (`tsup` is a good fit).
- Public API uses **named exports**, never default.
- Internal types prefixed with `_` are unstable; never document.
- Tests: colocated with the module they test. Each non-trivial module lives in its own folder (`src/<module>/index.ts` + `src/<module>/<module>.test.ts`); pure type-only files can stay flat. e2e tests go in `e2e/` with Playwright.
- Imports: use the short form for relative paths — `from './module'`, not `from './module/index.js'` or `from './module.js'`. Our `moduleResolution: "Bundler"` resolves both directory and file forms without explicit extensions, and tsup bundles everything for publishing so the source style doesn't affect output.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- One logical change per commit. No squash-bombs.
- Demos using template-literal embedded HTML/CSS (e.g. `examples/*-demo.ts`) **must not use backticks inside their content**, even in code-reference comments. Backticks close the outer template literal — `esbuild` rejects this at runtime and `biome` lint doesn't catch it.

## Things to refuse — repeat for emphasis

When you see PRs, issues, or requests for any of these, refuse and link to the non-goals section:

1. Captcha solving / bypass
2. Fingerprint masking
3. Proxy rotation
4. "Undetectable" or anti-bot framing
5. Time-of-day variation
6. AI-generated trajectories
