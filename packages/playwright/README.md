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
  personality: 'careful',  // careful | fast | distracted | precise
  seed: 'session-42',      // deterministic for tests
  speed: 'human',          // human | fast | instant
});

await human.goto('https://example.com');
```

See [humanjs.dev](https://humanjs.dev) for full documentation.

## License

MIT
