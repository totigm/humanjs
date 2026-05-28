# @humanjs/playwright

Humanize Playwright sessions for AI agents, QA tests, and demos. Drop-in adapter for an existing Playwright `Page`.

## Install

```bash
pnpm add @humanjs/playwright playwright
```

`playwright` is a peer dependency — bring your own version.

## Quick start

```ts
import { chromium, createHuman } from '@humanjs/playwright';

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

### Primitives

The full `Human` surface, at a glance. Each one fires real DOM events through Playwright; the humanization wraps the timing and the path, not the dispatch.

| Primitive | Purpose |
|---|---|
| `goto(url)` | Navigate the page. |
| `click(target)` | Bezier path → pre-click hover dwell → click. Occasionally near-misses (cursor wobble outside the target, then corrects) per `personality.mouse.misclickProbability`. |
| `rightClick(target)` | Same as `click` but with `button: 'right'`. Fires `contextmenu`. Same near-miss behavior. |
| `drag(from, to)` | Two-phase Bezier (to start → mouse down → curve to end → mouse up). Both endpoints accept `Locator \| string \| Point` — `Point` is essential for canvas / SVG / slider drags. Both endpoints independently near-miss per `misclickProbability` — a drag may wobble on the grab, the drop, both, or neither. |
| `hover(target)` | Walk to the element and settle. No click. Hover-state UI (tooltips, dropdowns) fires. |
| `move(target)` | Walk to a `Locator \| string \| Point`. Pure positional motion. No dwell, no element interaction — use this when you want the cursor parked somewhere with no implied click. |
| `type(target, value)` | Clicks the field for focus, then per-key rhythm with optional typos + Backspace recovery. |
| `paste(target, value)` | Clicks the field for focus, then `insertText` — instant insertion, no per-character timing. Cmd-V semantic. |
| `press(key)` | Single key (`'Tab'`) or chord (`'Mod+S'`). See [Keyboard](#keyboard) below. |
| `read(target)` | Dwell as a reader would. Cursor scans across the text in humanized mode. See [Reading](#reading). |
| `scroll(target?)` | Multi-segment wheel motion, bell-curve velocity, optional mid-scroll pauses. See [Scrolling](#scrolling). |
| `sleep(ms)` | Re-exported from `@humanjs/core` for convenience. |
| `record(fn)` | Wrap a block and export as mp4 / gif / JSON. See [Recording](#recording). |

Targets accept a CSS selector string or a Playwright `Locator`. `move` and `drag` additionally accept raw `Point` coordinates. Auto-scroll fires for any element-bound primitive when the target is outside the viewport — humanized scroll in normal speed modes, `scrollIntoViewIfNeeded` in `'instant'`.

Near-miss (cursor wobble before committing — see `personality.mouse.misclickProbability`) applies to the primitives that commit a button event at the resolved coordinates: `click`, `rightClick`, both `drag` endpoints, and the implicit focus-acquiring click inside `type` / `paste` (the keystrokes themselves are unaffected). `hover`, `move`, `press`, `read`, and `scroll` never misclick, by design — a wobble would trigger handlers on the wrong element for `hover`, and would contradict the explicit-coordinate contract for `move`. The misclick is also skipped when the cursor is already on the target (no approach means no overshoot).

### Keyboard

```ts
await human.press('Tab');               // single key
await human.press('Mod+S');             // cross-platform save (Meta on Mac, Control elsewhere)
await human.press('Cmd+Shift+P');       // literal Meta+Shift+P on every OS
await human.press('Control+C');         // literal Ctrl+C
await human.press('Shift+ArrowDown');   // extend selection down
```

`press` accepts a single key or a keyboard chord. IDE autocomplete enumerates every `Modifier+Key` combination — type `'Shift+'` and you get `Shift+A`, `Shift+B`, …, `Shift+Tab`, etc. as completions.

**Modifier rules:**

| Token | Resolves to | Notes |
|---|---|---|
| `Mod` / `CmdOrCtrl` / `CommandOrControl` | `Meta` on macOS, `Control` elsewhere | The right token for cross-platform app shortcuts. All three are aliases; `Mod` is shortest. |
| `Cmd` / `Command` / `Meta` / `Win` / `Super` | `Meta` keycode | Literal — does **not** auto-translate to `Control`. Same physical key on every OS. |
| `Ctrl` / `Control` | `Control` keycode | Literal — stays `Control` everywhere, so Mac-specific things like terminal `Ctrl+C` still work. |
| `Alt` / `Option` / `Opt` | `Alt` keycode | Literal. |
| `Shift` | `Shift` keycode | Literal. |

Case-insensitive at runtime. Modifier typos (`'Mosd+S'`) are caught at compile time — the modifier union is closed.

**Escape hatch for uncommon keys.** Uncommon keys (`'BracketLeft'`, `'NumpadAdd'`, locale-specific keys) and 3+ modifier chords aren't in the typed `KeyOrChord` union. Cast at the call site — the runtime parser handles them:

```ts
import type { KeyOrChord } from '@humanjs/playwright';

await human.press('Mod+BracketLeft' as KeyOrChord);
await human.press('Ctrl+Shift+Alt+K' as KeyOrChord);
```

Why a cast? Including a `(string & {})` escape hatch in the type collapses TypeScript's literal-template IntelliSense, so `'Shift+...'` completions disappear. Autocomplete wins for the 95% case; the cast handles the 5%.

**Press does NOT move the cursor** — keyboard input dispatches against focus, not cursor position. Compose with `click` / `hover` / `move` when you need both.

### Typing

```ts
await human.type('input[name="email"]', 'gonzalo@example.com');
```

`type` simulates a real keyboard. Per-key delays scale with the personality's typing speed (with jitter); the `distracted` personality occasionally injects QWERTY typos and recovers them with `Backspace`. Single ASCII characters route through Playwright's `keyboard.press` so per-key handlers (autocomplete, validation) fire; non-ASCII characters fall back to `keyboard.insertText` since `press` is keyboard-layout-aware and can't reliably synthesize `é` or `🎉` on every layout.

Like every other element-bound primitive, `type` clicks the field first to focus it — a real user moves the cursor to the input and clicks; they don't teleport-focus a field. The implicit click is a sub-step of the `'type'` action, not its own timeline event.

**Privacy.** The typed value is never echoed to plugin params. The `'type'` action surfaces only `{ target, length }` — by design, since this argument may carry passwords, tokens, or other secrets.

In `'instant'` speed mode, the humanized loop is bypassed for Playwright's `locator.pressSequentially(value, { delay: 0 })` — per-key events still fire, just without the timing.

### Pasting

```ts
await human.paste('textarea', longCodeBlock);
```

The Cmd-V semantic. `paste` clicks the field for focus (same mouse-led pattern as `type`), then dispatches the value via `page.keyboard.insertText` — instant, no per-character timing, the value lands in the field in a single beat.

When to use which:

- **`type`** — short strings where the per-key rhythm is the showcase (form fills, search queries, demo content). Slow on long input by design.
- **`paste`** — long content where humanized typing would be slow and uninformative (code blocks, multi-paragraph text, anything you'd realistically Cmd-V into the field).

`paste` does NOT fire the page's `paste` event. If you need that, drive it yourself: write to the clipboard, focus the field, then `human.press('Mod+V')`.

**Privacy.** Same posture as `type` — `{ target, length }` only.

### Dragging

```ts
await human.drag('#card-1', '#slot-3');                       // selector → selector
await human.drag('#slider-thumb', { x: 800, y: 450 });        // selector → Point
await human.drag('#card', locator);                           // any combination
```

Two-phase Bezier motion: walk to `from`, press the left button, curve to `to` with the button held, release. Each endpoint accepts a `Locator`, a CSS selector, or a raw `Point` coordinate.

The `Point` form is essential for canvas / SVG drags where the destination isn't a DOM element — sliders, signature pads, freehand drawing tools. The selector-to-Point shape is the canonical "drag this thumb to that position" pattern.

Both Bezier paths (start-to-`from` and `from`-to-`to`) are humanized independently with their own curvature and jitter, so drags don't trace robotic straight lines mid-flight.

Auto-scroll fires on both endpoints when needed — if the destination is below the fold, the cursor scrolls to bring it into view before releasing, the way a real user would scroll-to-grab then scroll-to-drop. Raw `Point` endpoints opt out of auto-scroll (explicit coordinates are the caller's responsibility).

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

`human.record(cb)` polls `page.screenshot()` at the target FPS, writes each frame to a temp directory, then assembles them via ffmpeg when you call an exporter:

- `rec.toVideo(path)` — `.mp4` (H.264 / yuv420p) or `.webm` (VP9)
- `rec.toGif(path, { fps?, width? })` — palette-optimized animated GIF (`palettegen` + `paletteuse`, Bayer dither). Defaults to 15 fps, source viewport size.

Both exporters are **repeatable and interleavable** — they read the captured frames, they don't consume them. Want an mp4 for the landing page *and* a GIF for the README from the same recording? Just call both:

```ts
const rec = await human.record(fn);
await rec.toVideo('demo.mp4');
await rec.toGif('demo.gif', { width: 720 });
// No explicit cleanup needed for one-shot scripts — see below.
```

Captured frames live in a temp directory under `os.tmpdir()`. Cleanup happens automatically at process exit (a single `process.on('exit')` handler sweeps any un-disposed frame dirs), so casual scripts don't have to think about it. For long-running services, batch jobs, or anywhere you want predictable disk usage, release them proactively:

```ts
await rec.dispose();                  // explicit, idempotent
// or with TS ≥ 5.2 / Node ≥ 20.4:
await using rec = await human.record(fn);   // auto-disposes at scope exit
```

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
- `Recording.toVideo()` / `Recording.toGif()` are repeatable and interleavable. Frames live until `rec.dispose()` (or `await using` goes out of scope, or the process exits — a sweep-on-exit handler covers forgotten disposes).
- For a one-call API that owns the entire lifecycle (launch → record → close), use [`@humanjs/recorder`](../recorder)'s `record(options, fn)` instead.

Every recording is a regular plugin action — `beforeAction` and `afterAction` observe `{ type: 'record' }` exactly like `'click'` or `'scroll'`.

## Using your own browser or a persistent profile

`createHuman(page)` wraps **any** Playwright `Page` — so reusing a saved login, your installed Chrome, or an already-running browser is just a matter of how you create that page. HumanJS adds nothing special here; these are standard Playwright entry points, collected so you don't have to hunt for them.

**Persistent profile** — keep cookies, local storage, and logins across runs. The first run signs in; later runs are already authenticated:

```ts
import { chromium, createHuman } from '@humanjs/playwright';

const context = await chromium.launchPersistentContext('./.humanjs-profile', {
  headless: false,
  channel: 'chrome', // optional: use installed Google Chrome instead of bundled Chromium
});
const page = context.pages()[0] ?? (await context.newPage());

const human = await createHuman(page, { personality: 'careful' });
// …drive the page; state persists in ./.humanjs-profile for next time
```

**Attach to an already-running browser** — drive a Chrome you started yourself, with all its existing tabs, extensions, and sessions. Launch Chrome with a debugging port first (`chrome --remote-debugging-port=9222`), then:

```ts
import { chromium, createHuman } from '@humanjs/playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());

const human = await createHuman(page, { personality: 'careful' });
```

> **Heads up:** a persistent profile or a connected real browser carries whatever you're signed into. Driving it means the automation can act with those sessions' privileges — keep that in mind for anything sensitive, and be wary of pages that try to manipulate an agent into actions while logged in.

## License

MIT
