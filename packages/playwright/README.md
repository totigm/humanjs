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

See [humanjs.dev](https://humanjs.dev) for the full feature set and personality reference.

## License

MIT
