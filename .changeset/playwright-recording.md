---
"@humanjs/playwright": minor
---

Add humanized session recording — capture a slice of a Playwright session as mp4 or webm, plus a structured JSON action timeline.

```ts
import { chromium, createHuman, installMouseHelper } from '@humanjs/playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await installMouseHelper(context);

const human = await createHuman(page);

const rec = await human.record(async () => {
  await human.click('#login');
  await human.type('#email', 'demo@humanjs.dev');
});

await rec.toVideo('demo.mp4');
await rec.toTimeline('demo.json');
await browser.close();
```

New public surfaces:

- **`human.record(cb)`** — records the wall-clock window of the callback by polling `page.screenshot()` at the target FPS and writing each frame to a temp directory. Returns a `Recording`. Supports `{ video: false }` for timeline-only mode (zero capture overhead) and `{ quality: 'fast' | 'standard' | 'high' | 'lossless' }`.
- **`Recording`** — class with `toVideo(path, options?)` (ffmpeg-assembled mp4/webm with quality presets and ffmpeg knob overrides), `toTimeline(path)` (structured JSON), and `.timeline` (in-memory). All exporters are repeatable; captured frames live until `dispose()` (or until the sweep-on-exit handler cleans them at process end — see the toGif changeset for the lifecycle details).
- **`Timeline`** + **`TimelineEvent`** — public schema for the captured action timeline, versioned at `1`. Intended for observability pipelines, replay infrastructure, and debugger UIs.
- **Re-exports**: `chromium`, `firefox`, `webkit`, `Browser`, `BrowserContext`, `Page`, `Locator`, `LaunchOptions`, `BrowserContextOptions`, `ElementHandle` from Playwright — so users have a single import surface for the integration's common case.

`installMouseHelper` also got a robustness fix: the visible cursor now survives `page.setContent()` (which Playwright doesn't treat as a navigation, so `addInitScript` doesn't fire). The helper now also re-injects on every `domcontentloaded` event, and the in-page idempotency guard checks for the cursor DOM element instead of a window flag (the window persists across `setContent` but the element doesn't).

For a one-call API that owns the entire browser/page lifecycle, see [`@humanjs/recorder`](../recorder).
