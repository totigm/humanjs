<p align="center">
  <img src="./.github/banner.jpg" alt="HumanJS — humanize your browser automation" width="640">
</p>

<h1 align="center">HumanJS</h1>

<p align="center">
  <b>Humanize browser automation for AI agents, QA tests, and demos.</b><br>
  <sub>Playwright that moves, types, scrolls, and reads like a real person.</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@humanjs/playwright"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/playwright"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="#license"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/playwright"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
  <a href="https://github.com/totigm/humanjs/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/totigm/humanjs?style=flat"></a>
</p>

---

## Why

Modern websites are increasingly hostile to all browser automation, and they can't tell the difference between a scraper and an AI agent acting on a user's instructions. Cloudflare, DataDome, PerimeterX read your mouse trajectory and interaction rhythm — and they block on it.

If you're building:

- **AI agents** (Browser Use, Stagehand, Playwright MCP) that book flights, fill forms, or monitor accounts on behalf of users
- **QA tests** where race conditions, debounced inputs, or animation states only break at real-user pace
- **Demos and walkthroughs** that need to look human-paced instead of robotic
- **Onboarding recordings** or supervised agent monitoring

…then your robotic Playwright runs are the problem.

HumanJS makes interactions feel natural. Curved mouse paths. Typing rhythm with hesitation. Reading dwell time based on word count. Configurable personalities. Drop-in for Playwright.

## What HumanJS is not

A stealth tool. We do not ship:

- ❌ Captcha solvers
- ❌ Fingerprint masking
- ❌ Proxy rotation
- ❌ "Undetectable" promises

Sophisticated anti-bot systems will still detect us. We reduce friction for legitimate use cases — and we say no to the rest by design. If you need evasion tooling, you want a stealth plugin, not HumanJS.

## Install

```bash
npm install @humanjs/playwright
# or
pnpm add @humanjs/playwright
```

## Quick start

```ts
import { chromium, createHuman } from '@humanjs/playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const human = await createHuman(page, {
  personality: 'careful',  // careful | fast | distracted | precise
  seed: 'session-42',      // deterministic for tests
  speed: 'human',          // human | fast | instant
});

await human.goto('https://example.com');
await human.click('Sign in');
await human.type('Email', 'gonzalo@example.com');
await human.paste('Password', process.env.PW!);
await human.read('Welcome back');
await human.scroll('natural');
```

Everything that's not specified humanizes by default. Selectors prefer accessible names and roles over CSS. Determinism via `seed`. CI-friendly via `speed: 'instant'`.

## Personalities

```ts
await createHuman(page, { personality: 'careful' });    // slow, precise, few mistakes
await createHuman(page, { personality: 'fast' });       // quick but still natural
await createHuman(page, { personality: 'distracted' }); // scrolls back, retypes, hovers
await createHuman(page, { personality: 'precise' });    // minimal noise, smooth motion
```

Extend, override, or blend:

```ts
await createHuman(page, {
  personality: { extends: 'careful', typing: { typoProbability: 0.1 } },
});

await createHuman(page, {
  personality: blend('careful', 'distracted', 0.3),
});
```

Or build your own and publish it as `@yourname/personality-*`. The full `Personality` type is exported and stable.

## AI agent integrations

```ts
// Browser Use
import { BrowserUse } from 'browser-use';
import { wrap } from '@humanjs/browser-use';

const agent = wrap(new BrowserUse({ /* ... */ }), { personality: 'careful' });

// Stagehand
import { Stagehand } from '@browserbasehq/stagehand';
import { wrap } from '@humanjs/stagehand';

const stagehand = wrap(new Stagehand({ /* ... */ }), { personality: 'fast' });
```

```bash
# MCP server — drive a humanized browser from Claude Code, Claude Desktop,
# Cursor, Codex, Cline, and any other MCP client. Register it in one command:
claude mcp add humanjs -- npx -y @humanjs/mcp
```

…or one-click for Cursor:

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=humanjs&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBodW1hbmpzL21jcCJdfQ==)

Every action goes through HumanJS without changing your agent code. See [`@humanjs/mcp`](./packages/mcp/README.md) for the full tool catalog and per-client config.

## Recorder

```ts
const recording = await human.record(async () => {
  await human.goto('/checkout');
  await human.click('Buy now');
  await human.type('Card number', '4242424242424242');
});

await recording.toVideo('checkout.mp4');     // mp4 / webm of the session
await recording.toGif('checkout.gif');       // palette-optimized gif for README embeds
await recording.toTimeline('checkout.json'); // structured JSON for analysis
// recording.toPlaywright('checkout.spec.ts') — Playwright code export coming in a follow-up
```

Or one-call for the simple case (browser/page lifecycle handled for you):

```ts
import { record } from '@humanjs/recorder';

await record({ output: 'demo.mp4' }, async (human) => {
  await human.click('a');
  await human.type('#search', 'humanjs');
});
```

Or use the visual generator:

```bash
npx @humanjs/generator https://your-app.com
```

Click through your app, pick a personality, export to clean Playwright + HumanJS.

## In tests

```ts
import { test, expect } from '@playwright/test';
import { createHuman } from '@humanjs/playwright';

test('checkout flow', async ({ page }) => {
  const human = await createHuman(page, {
    personality: 'careful',
    seed: test.info().title,
    speed: process.env.CI ? 'instant' : 'human',
  });

  await human.goto('/');
  await human.click('Buy now');
  await expect(page).toHaveURL(/checkout/);
});
```

The `seed` makes runs deterministic. `speed: 'instant'` in CI keeps your test suite fast.

## Compared to alternatives

| | HumanJS | Playwright | ghost-cursor |
|---|:-:|:-:|:-:|
| Mouse trajectories | ✅ | ❌ | ✅ |
| Typing rhythm | ✅ | ❌ | ❌ |
| Reading dwell | ✅ | ❌ | ❌ |
| Scroll humanization | ✅ | ❌ | ✅ |
| Personalities | ✅ | ❌ | ❌ |
| Session recorder + code export | ✅ | partial | ❌ |
| AI agent adapters (Browser Use, Stagehand, MCP) | ✅ | ❌ | ❌ |
| Playwright-native | ✅ | ✅ | ❌ (Puppeteer) |
| Deterministic via seed | ✅ | n/a | ❌ |

ghost-cursor pioneered humanized mouse paths and is excellent at what it does. HumanJS is for the broader job: humanizing entire interaction sessions in Playwright, with first-class support for AI agents and QA suites.

## Honest limits

- HumanJS **will not** defeat sophisticated bot detection (fingerprinting, TLS analysis, request patterns).
- HumanJS slows down test runs unless you use `speed: 'fast'` or `speed: 'instant'`.
- HumanJS is Playwright-first. Puppeteer support is on the roadmap, not v1.
- HumanJS does **not** rotate proxies, spoof fingerprints, or solve captchas. We will not add these. Open an issue and we'll close it.

## Roadmap

- [x] Mouse + scroll + typing + reading primitives
- [x] Personalities (careful, fast, distracted, precise) + blend / extend
- [x] Session recorder → mp4 / Playwright code / JSON
- [x] AI agent adapters (Browser Use, Stagehand, MCP)
- [ ] Visual generator (`@humanjs/generator`)
- [ ] Plugin system + community personalities (`@humanjs-community/personality-*`)
- [ ] Recipes (`@humanjs/recipes`) for common flows
- [ ] Touch / mobile humanization
- [ ] Puppeteer adapter (`@humanjs/puppeteer`)

## Contributing

We welcome PRs that:

- Improve interaction realism
- Add primitives for new behaviors (keyboard shortcuts, drag-and-drop, right-click menus, etc.)
- Publish personalities or recipes
- Build agent adapters

We do not accept PRs that:

- Implement captcha solvers, fingerprint masking, or proxy management
- Position HumanJS as a stealth tool

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Credits

The cubic Bezier path math behind humanized mouse trajectories is adapted from [ghost-cursor](https://github.com/Xetera/ghost-cursor) by [@Xetera](https://github.com/Xetera) (MIT-licensed). HumanJS humanizes a much broader surface — typing rhythm, reading dwell, scroll, the plugin system, personalities, AI-agent adapters — but the underlying coordinate generation builds on their solid foundation. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for full attribution.

## License

MIT — see [LICENSE](./LICENSE).

---

<p align="center">
  <sub>Built by <a href="https://www.munoz.dev">Gonzalo Muñoz</a>.</sub>
</p>
