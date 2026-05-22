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

## License

MIT
