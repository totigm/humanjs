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

**Eye-scan cursor motion** runs during the dwell by default:

```ts
await human.read('article');                       // motion: on
await human.read('article', { withMotion: false }); // motion: off
```

The cursor walks a humanized L→R sweep through every line of rendered text and emits a small return-saccade between lines — same `mousemove` events a real reader would dispatch (so reading-time tooltip / hover handlers fire). Pass `{ withMotion: false }` when you only care about the temporal pattern (typical AI-agent use case).

For demos and screen recordings, pair it with `installMouseHelper(page)` to render a visible cursor that follows the synthetic motion:

```ts
import { createHuman, installMouseHelper } from '@humanjs/playwright';

const page = await context.newPage();
await page.goto('https://example.com/article');
await installMouseHelper(page);

const human = await createHuman(page, { personality: 'careful' });
await human.read('article');
```

**Returns** a `ReadResult`:

```ts
const { words, durationMs, kind } = await human.read('main');
```

Useful for test assertions or surfacing reading metadata in a UI.

**Privacy**: the read text is never echoed to plugin params. `read` actions surface only `{ target, kind }` plus inert length metadata — the content itself stays out of telemetry by design, same posture as `human.type()`.

### Scrolling

```ts
await human.scroll();           // ~one viewport down, humanized
```

`human.scroll()` produces multi-segment scroll motion with a bell-curve velocity profile (slow start, fast middle, slow end), optional mid-scroll micro-pauses, and — for the `distracted` personality — occasional overshoot + correction. Page scrolls dispatch real `wheel` events; container scrolls advance the element's scroll position directly (more reliable inside nested overflow containers).

**Target options:**

```ts
await human.scroll();                       // 'natural' — ~one viewport
await human.scroll('top');                  // to the top
await human.scroll('end');                  // to the bottom
await human.scroll({ by: 800 });            // relative pixel delta (negative = up)
await human.scroll({ to: 1500 });           // absolute scroll position on the chosen axis
await human.scroll('#pricing');             // by selector — scroll until in view
await human.scroll(locator);                // by Locator
```

**Element-target alignment** matches native `scrollIntoView`:

```ts
await human.scroll('#hero', { block: 'center' });   // 'start' | 'center' | 'end' | 'nearest'
```

`'nearest'` is a useful default for "make sure this element is visible without moving more than necessary" — it stays put if the element is already fully in view, otherwise scrolls to the closest edge.

**Scroll inside a scrollable container**, not the page:

```ts
await human.scroll('end', { within: '#messages' });               // chat thread to latest
await human.scroll('#newest-item', { within: '.feed', block: 'end' });
await human.scroll({ by: -200 }, { within: modalBody });          // scroll up inside a modal
```

Every target shape (`'natural'`, `'top'`, `'end'`, selectors, `{ by }`, `{ to }`) applies relative to the container. In humanized mode the cursor parks over the container's center (so an `installMouseHelper` overlay reads as "human hand on the wheel") and each segment advances the container's `scrollLeft` / `scrollTop` directly — more reliable than wheel events inside nested overflow containers. In `'instant'` mode the container's scroll position is set with a single `scrollTo` call.

**Horizontal scroll** via `axis: 'x'` — same target shapes apply to the X axis:

```ts
await human.scroll('end', { axis: 'x' });                         // to the right edge
await human.scroll({ by: 400 }, { axis: 'x' });                   // 400px right
await human.scroll('#card-5', { axis: 'x', block: 'center' });    // carousel to a card
await human.scroll('end', { within: '#kanban', axis: 'x' });      // kanban board to the right end
```

Defaults to `'y'`. Combine with `within` for horizontal scrolling inside a container (carousels, kanban boards, sideways galleries).

**Force overshoot** even when the personality wouldn't choose one — useful for demos and screen recordings where the humanization signal needs to read clearly:

```ts
await human.scroll('#footer', { overshoot: true });
```

**Returns** a `ScrollResult`:

```ts
const { from, to, distance, durationMs } = await human.scroll('end');
```

In `speed: 'instant'`, the page jumps directly via `window.scrollTo` — no wheel events — but the action still fires for observability.

See [humanjs.dev](https://humanjs.dev) for the full feature set and personality reference.

### Recording

```ts
import { chromium, createHuman, installMouseHelper } from '@humanjs/playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

// Visible cursor overlay so the recorded video shows mouse motion.
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

`human.record(cb)` polls `page.screenshot()` at the target FPS, writes each frame to a temp directory, then assembles them via ffmpeg when you call `toVideo(path)`. The output format is inferred from the extension — `.mp4` (H.264 / yuv420p) or `.webm` (VP9).

The same `Recording` exposes a **structured action timeline** of everything that happened during the callback:

```ts
await rec.toTimeline('session.json');   // → JSON on disk
const timeline = rec.timeline;          // → in-memory object
```

The shape (`Timeline` with `personality`, `seed`, `speed`, `durationMs`, and an `events` array of `{ type, params, tMs, durationMs }`) is intended for observability pipelines, replay infrastructure, analytics, and debugger UIs. `toTimeline()` doesn't touch the browser context — call it before or after `toVideo()`, multiple times, in any order.

**Quality presets** trade off file size, encoding time, and visual fidelity. Defaults to `'high'`:

```ts
await rec.toVideo('demo.mp4', { quality: 'high' });
// 'fast'     — JPEG q=85, CRF 23, preset fast            (iteration)
// 'standard' — JPEG q=90, CRF 20, preset fast            (balanced)
// 'high'     — JPEG q=95, CRF 18, preset slow, animation (DEFAULT)
// 'lossless' — PNG capture, CRF 12, preset veryslow      (archival)
```

Individual ffmpeg knobs (`crf`, `preset`, `tune`) can override the preset for fine-grained control.

**Timeline-only mode** — skip the capture overhead entirely when you only need the action timeline:

```ts
const rec = await human.record({ video: false }, async () => {
  await human.click('#login');
});
await rec.toTimeline('session.json');   // works
// rec.toVideo('demo.mp4')               // throws with a clear message
```

**Lifecycle notes**:

- Each session can produce **one** recording. `human.record()` throws if called twice on the same session — open a new context (and a new human) to record a separate clip.
- `Recording.toVideo()` is single-use because it cleans up the captured frames after assembly.
- For a one-call API that owns the entire lifecycle (launch → record → close), use [`@humanjs/recorder`](../recorder)'s `record(options, fn)` instead.

Every recording is a regular plugin action — `beforeAction` and `afterAction` observe `{ type: 'record' }` exactly like `'click'` or `'scroll'`.

## License

MIT
