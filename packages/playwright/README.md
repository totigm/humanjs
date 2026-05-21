# @humanjs/playwright

Humanize Playwright sessions for AI agents, QA tests, and demos. Drop-in adapter for an existing Playwright `Page`.

## Install

```bash
pnpm add @humanjs/playwright playwright
```

`playwright` is a peer dependency — bring your own version.

## Quick start

```ts
import { chromium } from 'playwright';
import { createHuman } from '@humanjs/playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const human = await createHuman(page, {
  personality: 'careful', // careful | fast | distracted | precise
  seed: 'session-42',     // deterministic for tests
  speed: 'human',         // human | fast | instant
});

await human.goto('https://example.com');

// Mouse: real Bezier path, velocity profile, pre-click hover dwell.
await human.click('button:has-text("Sign in")');

// Keyboard: per-key rhythm, optional QWERTY typos, Backspace recovery,
// occasional mid-word think pauses. The typed string is *not* echoed to
// plugin params — `params.length` only, by design.
await human.type('input[name="email"]', 'gonzalo@example.com');
```

### Speed modes

- `'human'` (default) — full humanization on every action.
- `'fast'` — humanized but accelerated.
- `'instant'` — bypass humanization entirely; uses Playwright's native methods. Per-key events still fire for `type()`. Right for CI.

### Determinism

Pass a `seed` and every random decision (path curvature, typo placement, keystroke jitter) becomes reproducible. Same seed + same personality + same value = same keystrokes.

### Reading

```ts
await human.read('p.welcome');
```

`human.read()` dwells like a real reader — pause-time scaled by the target's word count and the personality's reading WPM (with personality-controlled jitter).

**Target options:**

- `string` — Playwright-compatible selector
- `Locator` — a pre-built Locator
- `{ text: '...' }` — literal text, no DOM lookup
- `{ words: 42 }` — pre-counted; skips text extraction entirely

**Reading kinds** scale the dwell on top of `personality.reading.wpm`:

- `'prose'` (1.0×) — default for non-code targets
- `'code'` (0.4×) — slower; auto-detected when the target is a `<pre>` or `<code>` element
- `'scan'` (1.8×) — explicit skim mode

```ts
await human.read('.article-body');                     // prose, default
await human.read('pre.snippet');                       // 'code' auto-detected from <pre>
await human.read('ul.changelog', { kind: 'scan' });    // explicit skim
```

Explicit `kind` always wins over auto-detection.

**Visible eye-scan motion** during the dwell:

```ts
await human.read('article', { withMotion: true });
```

The cursor walks a humanized L→R sweep through every line of rendered text and emits a small return-saccade between lines — same `mousemove` events a real reader would dispatch (so reading-time tooltip / hover handlers fire). Off by default.

For demos and screen recordings, pair `withMotion` with `installMouseHelper(page)` to render a visible cursor that follows the synthetic motion:

```ts
import { createHuman, installMouseHelper } from '@humanjs/playwright';

const page = await context.newPage();
await page.goto('https://example.com/article');
await installMouseHelper(page);

const human = await createHuman(page, { personality: 'careful' });
await human.read('article', { withMotion: true });
```

**Returns** a `ReadResult`:

```ts
const { words, durationMs, kind } = await human.read('main');
```

Useful for test assertions or surfacing reading metadata in a UI.

**Privacy**: the read text is never echoed to plugin params. `read` actions surface only `{ target, kind }` plus inert length metadata — the content itself stays out of telemetry by design, same posture as `human.type()`.

See [humanjs.dev](https://humanjs.dev) for the full feature set and personality reference.

## License

MIT
