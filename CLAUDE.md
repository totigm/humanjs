# HumanJS

Humanized browser automation for AI agents, QA tests, and demos. Playwright-first.

> This file is the brief loaded into every Claude session in this repo. Keep it lean.
> Architectural reasoning lives in [`docs/DESIGN.md`](./docs/DESIGN.md) (public). Strategic and personal notes live in `docs/PROJECT_BRIEF.md` (local-only, gitignored).

## Project status

Greenfield — no code yet. We're scaffolding the v1 monorepo from scratch.

## Positioning (immutable)

**HumanJS humanizes browser automation for AI agents (Browser Use, Stagehand, Playwright MCP), QA tests where real-pace timing exposes bugs, and demo/tutorial recordings.**

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

Verified available on npm at project start: `@humanjs/core`, `@humanjs/playwright`, `@humanjs/recorder`, `@humanjs/browser-use`, `@humanjs/stagehand`, `@humanjs/mcp`, `@humanjs/generator`, `@humanjs/skill`, `@humanjs/recipes`. Unscoped `humanjs` is owned by a dormant 2022 package — irrelevant scope, doesn't block us.

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
| `@humanjs/browser-use` | Browser Use integration adapter | v1 |
| `@humanjs/stagehand` | Stagehand integration adapter | v1 |
| `@humanjs/mcp` | MCP server for runtime AI agents | v1 |
| `@humanjs/skill` | Anthropic / Cursor / Cline skill for AI coding agents | v1 |
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
await human.type(selector, value);        // realistic typing rhythm
await human.paste(selector, value);       // Cmd-V style (no per-char timing)
await human.read(text);                   // dwell based on word count
await human.scroll('natural');
await human.shortcut('Cmd+S');
await human.drag(from, to);
await human.rightClick(selector);

const rec = await human.record(async () => { /* actions */ });
rec.toVideo('out.mp4');
rec.toPlaywright('test.spec.ts');
rec.toTimeline('session.json');
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
- AI agent adapters: Browser Use, Stagehand, MCP, plus Claude/Cursor/Cline skill

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

## Conventions

- TypeScript strict. No `any` without an inline comment justifying it.
- ESM-first; dual-publish CJS where needed (`tsup` is a good fit).
- Public API uses **named exports**, never default.
- Internal types prefixed with `_` are unstable; never document.
- Tests: colocated with the module they test. Each non-trivial module lives in its own folder (`src/<module>/index.ts` + `src/<module>/<module>.test.ts`); pure type-only files can stay flat. e2e tests go in `e2e/` with Playwright.
- Imports: use the short form for relative paths — `from './module'`, not `from './module/index.js'` or `from './module.js'`. Our `moduleResolution: "Bundler"` resolves both directory and file forms without explicit extensions, and tsup bundles everything for publishing so the source style doesn't affect output.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- One logical change per commit. No squash-bombs.

## Things to refuse — repeat for emphasis

When you see PRs, issues, or requests for any of these, refuse and link to the non-goals section:

1. Captcha solving / bypass
2. Fingerprint masking
3. Proxy rotation
4. "Undetectable" or anti-bot framing
5. Time-of-day variation
6. AI-generated trajectories
