# HumanJS — Design Notes

Architectural reasoning behind HumanJS. Companion to the README — the README explains *what* the project is, this document explains *why* it's shaped this way.

## Use cases

Modern websites have become hostile to all browser automation, and detection systems can't distinguish between a scraper and an AI agent acting on a user's instructions. Cloudflare, DataDome, and PerimeterX read mouse trajectory and interaction rhythm — and they block on it.

Five categories of legitimate use where humanization matters:

1. **User-authorized AI agents** running routine tasks on behalf of their owner — booking flights, monitoring listings, filling forms — that get caught by interaction-timing heuristics.
2. **Agent product vendors** (Operator, Playwright MCP, and other agent frameworks) who don't want their tool banned from the open web because every flow looks robotic.
3. **QA tests** where race conditions, debounced inputs, and animation states only manifest at human pace. Robotic test runs hide real bugs by skipping the timing windows where they appear.
4. **Demo videos and product walkthroughs** that need to look human-paced. Robotic Playwright recordings break the suspension of disbelief in marketing material.
5. **Tutorial recordings and supervised agent monitoring** — a 50-actions-per-second agent is unwatchable. Humanization makes review sessions legible.

What HumanJS deliberately does *not* do: defeat sophisticated bot detection. Stealth tooling — captcha solvers, fingerprint masking, proxy rotation, TLS-level masking — is out of scope, refused on principle, and will not appear on the roadmap. The audience is people building legitimate automation.

## Competitive landscape

The closest existing project is **ghost-cursor**: Puppeteer-only, focused on coordinate generation (Bezier curves + Fitts's Law). Excellent at what it does, MIT-licensed, well-maintained.

HumanJS does not compete with ghost-cursor on coordinate math. The math is sound and reusable — HumanJS uses ghost-cursor's `path()` (or an equivalent) under the hood. The differentiation is everything *above* the coordinate math:

- Native Playwright integration (Playwright is now the dominant stack for testing and AI agents)
- Typing rhythm, reading dwell, scroll behavior — interaction layers ghost-cursor doesn't address
- Personality system with seedable determinism
- Session recorder with multi-format export
- AI agent integration via an MCP server
- Plugin system for third-party extensions

### Why HumanJS is not framed as "an alternative to ghost-cursor"

Ghost-cursor's positioning leans toward scraping evasion. That tone defines its audience: most installs serve anti-bot use cases. Trying to be a better ghost-cursor inherits that audience.

The Playwright + AI-agent slice is a different shelf in the same store. Same humanization code, different audience, different reputation. By positioning around AI agent vendors and QA, HumanJS attracts users who ship products and recommend libraries in respectable contexts.

## Architecture decisions

### Monorepo with independent package versioning

pnpm workspaces, with Turborepo for task orchestration and Changesets for releases. Each package versions independently.

Independent versioning matters: the recorder and the Playwright adapter evolve at different rates. Locked versions across the whole product would mean shipping no-op bumps every release.

### Playwright-first

Playwright has passed Puppeteer for testing and is the de facto AI-agent stack — Playwright MCP and most agent frameworks build on it. Building on Playwright first opens the larger audience. Puppeteer is a roadmap adapter, not v1 scope.

### Plugin system from day one

The most important architectural decision. Even if v1 ships no plugins, the contract must exist:

```ts
interface HumanPlugin {
  name: string;
  install(human: HumanInstance): void;
  // hooks: beforeAction, afterAction, etc.
}

await createHuman(page, { plugins: [...] });
```

Without it, every future feature requires core API churn. With it, the community can extend behavior cleanly, and HumanJS evolves without breaking changes.

### Personalities as a first-class, exported type

The `Personality` type is published from `@humanjs/core` with a stable contract from v1. Anyone can ship `@anything/personality-*`. This is a compounding distribution vector: each community personality is a small surface that points back at the core.

Built-in presets are deliberately limited to four: `careful`, `fast`, `distracted`, `precise`. Depth over breadth — the rest belongs to the community.

### Determinism via seed

Every random call threads through a seeded PRNG. `{ seed: 'x' }` produces identical trajectories every run.

Without this, HumanJS can't be used in snapshot tests — which kills the QA audience. With it, snapshot tests of personality outputs become the regression suite, and CI runs are fully reproducible.

### Speed modes

Three modes: `human` (full humanization, default), `fast` (humanized but accelerated), `instant` (bypass all humanization — straight Playwright).

`instant` mode is what makes HumanJS safe to drop into existing test suites. No team has to choose between humanization and CI speed: humanize locally for catching real-user bugs, run instant in CI for fast pipelines.

## AI agent integrations

We evaluated thin `wrap()` adapters for the popular agent frameworks and decided against shipping them:

- **Browser Use** is Python-first — there's no clean way to wrap it from a TypeScript package.
- **Stagehand v3** went CDP-native: its `act()` / `agent()` dispatch raw Chrome DevTools Protocol input events through an internal engine ("understudy"), bypassing Playwright entirely. HumanJS humanizes by intercepting Playwright `Page` / mouse / keyboard calls — and in v3 there's nothing to intercept, so a wrapper cannot humanize Stagehand's actions. The only fallback (`observe()` to get an xpath, then execute it yourself via HumanJS) is a ~10-line user recipe, doesn't cover `agent()`, and isn't worth a maintained package.

So HumanJS integrates with AI agents through two surfaces, each targeting a different audience:

### `@humanjs/mcp` — MCP server

A standalone MCP server. AI agents that speak MCP (Claude with browser tools, Playwright MCP users, custom agents) connect to it as a tool provider:

```bash
npx @humanjs/mcp
# Exposes tools: human_click, human_type, human_read, human_record, ...
```

It requires no code changes in the agent — any MCP-capable agent gets humanization for free.

### `@humanjs/skill` — coding-agent skill

A skill for Claude Code, Cursor, and Codex. When a developer uses an AI coding assistant to write Playwright tests, the skill activates and suggests HumanJS APIs. Distribution: skill registries for each ecosystem.

## Recorder and generator

Two related but distinct features.

### Recorder (`@humanjs/recorder`, v1)

In-code recording of a programmatic session, exportable to three formats:

```ts
const rec = await human.record(async () => {
  await human.goto('/checkout');
  await human.click('Buy now');
});

rec.toVideo('checkout.mp4');           // for demos and bug repros
rec.toPlaywright('checkout.spec.ts');  // ready-to-commit test code
rec.toTimeline('checkout.json');       // structured analysis data
```

Three output formats because three audiences want different things: marketers want video, engineers want test code, agent builders want structured timelines for analysis.

### Generator (`@humanjs/generator`)

> **Shipping as of `0.1.0`.** See the package [README](../packages/generator/README.md) for usage and the [ROADMAP](../packages/generator/ROADMAP.md) for what's next. The design below is the original plan, now realized.

A standalone CLI — not an iframe-based recorder. (Iframe-based recorders are blocked by `X-Frame-Options` on most real sites; the pattern doesn't scale.)

Flow, similar to Playwright Codegen:

1. `npx @humanjs/generator <url>` launches a real Chromium window.
2. CLI also opens a local dashboard.
3. A content script in the page records clicks, keystrokes, scrolls, and navigation — with the CSS selectors and accessible names of each element.
4. Dashboard shows the recording timeline live — user can label steps, delete junk, reorder, edit text.
5. User picks a personality and exports a clean `.spec.ts` using HumanJS.

Differentiation from Playwright Codegen:

- Output uses HumanJS APIs (humanized clicks, typing, reading)
- Personality switcher in the UI — same recording, multiple shapes of output
- Edit-before-export UI (Playwright Codegen has none)
- Better selector inference: roles + accessible names + test IDs before CSS / XPath
- Annotations preserved in generated code
- Point-and-add assertions (`toBeVisible` / `toHaveText` / `toHaveURL`) and secret fields exported as `process.env.*`

It was deliberately held until v1 core was stable so the two didn't split focus. The editor (Vite + React) is bundled into the package and served by the CLI on a loopback port; the curated timeline runs through `@humanjs/playwright`'s codegen, so generated specs stay in lockstep with the library.

## Personalities — design rationale

The single most differentiated feature. The layered API:

```ts
// 1. Preset
{ personality: 'careful' }

// 2. Preset + targeted override
{ personality: { extends: 'careful', typing: { typoProbability: 0.1 } } }

// 3. Fully custom
{ personality: { speed, mouse, typing, reading, dwell } }

// 4. Composition
{ personality: blend('careful', 'distracted', 0.3) }

// 5. Community-published
import { grandma } from '@yourname/personality-grandma';
{ personality: grandma }
```

Each layer addresses a distinct case: presets for ergonomics, overrides for targeted tweaks, fully-custom shapes for unusual tests, blending for compositional cases, community packages for ecosystem growth.

Built-in presets stay limited to four. Adding more presets without strong justification dilutes them. The `@anything/personality-*` ecosystem is where breadth lives.

## Conventions

- TypeScript strict throughout. No `any` without an inline justification.
- ESM-first; dual-publish CJS where needed via `tsup`.
- Public APIs use named exports only — never default.
- Internal types prefixed with `_` are unstable and undocumented.
- Tests `*.test.ts` colocated with source; e2e in `e2e/` with Playwright.
- Conventional commits, one logical change per commit.
