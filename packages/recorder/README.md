# @humanjs/recorder

<p>
  <a href="https://www.npmjs.com/package/@humanjs/recorder"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/recorder"></a>
  <a href="https://www.npmjs.com/package/@humanjs/recorder"><img alt="downloads" src="https://img.shields.io/npm/dt/@humanjs/recorder"></a>
  <a href="https://github.com/totigm/humanjs"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-totigm%2Fhumanjs-181717?logo=github"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/totigm/humanjs/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/recorder"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
</p>

One-call session recording for [HumanJS](https://humanjs.dev) — turn a humanized Playwright session into an mp4, an animated GIF, a structured JSON timeline, or any combination.

## Install

```bash
pnpm add @humanjs/recorder @humanjs/playwright playwright
```

`@humanjs/playwright` bundles `ffmpeg-static`, so no system ffmpeg install is required.

## Quick start

```ts
import { record } from '@humanjs/recorder';

// Record a session to mp4
await record({ output: 'demo.mp4' }, async (human) => {
  await human.click('a');
  await human.type('#search', 'humanjs');
});

// Timeline-only — no video overhead
const rec = await record(async (human) => {
  await human.click('#login');
});
await rec.toTimeline('actions.json');
```

`record()` launches a browser, opens a page, creates a humanized session, runs the callback, manages the entire lifecycle — and returns a `Recording` you can export to any supported format.

## API shape

Two overloads — pass options when you have them, skip them when you don't:

```ts
// No options needed
const rec = await record(async (human) => { ... });

// With options
const rec = await record({ output: 'demo.mp4', personality: 'careful' }, async (human) => { ... });
```

The returned `Recording` has:

| | |
|---|---|
| `rec.toVideo(path, options?)` | Write an mp4 or webm. Repeatable. |
| `rec.toGif(path, options?)` | Write an animated GIF (palette-optimized, defaults to 15fps). Repeatable. |
| `rec.toTimeline(path)` | Write the structured JSON timeline. Repeatable. |
| `rec.toHumanJS(path)` | Write a runnable HumanJS script that replays the session. |
| `rec.toPlaywright(path)` | Write a `@playwright/test` spec (humanized — uses HumanJS). |
| `rec.timeline` | Read the in-memory `Timeline` object. |
| `rec.durationMs` | Wall-clock duration of the recorded window. |
| `rec.hasVideo` | True if frames were captured (i.e. `output` was set). |
| `rec.dispose()` | *Optional.* Release the captured-frames temp directory early — otherwise a sweep-on-exit handler cleans it when the process ends. After this, `toVideo` / `toGif` throw; `toTimeline` still works. Idempotent. |

The exporters are **repeatable and interleavable** — they read the captured frames, they don't consume them. If `output` was passed to `record()`, the matching exporter has already run for you, but you can still call any other exporter (or call the same one again to a different path) on the returned recording. Want mp4 and GIF from the same recording? Just do both:

```ts
const rec = await record({ output: 'demo.mp4' }, async (human) => { ... });
await rec.toGif('demo.gif', { width: 720 });
await rec.toTimeline('demo.json');
// Done. No explicit cleanup needed for one-shot scripts.
```

Captured frames live in a temp dir under `os.tmpdir()`. A `process.on('exit')` handler installed on first use sweeps any un-disposed frame dirs, so casual scripts don't have to think about lifecycle. For long-running services or anywhere you want predictable disk usage, call `await rec.dispose()` (idempotent) or use `await using rec = await record(...)` (TypeScript ≥ 5.2 / Node ≥ 20.4).

## Options

```ts
await record(
  {
    output: 'demo.mp4',          // .mp4 / .webm / .gif — omit to skip video entirely
    quality: 'high',             // 'fast' | 'standard' | 'high' (default) | 'lossless'
    captureInputs: true,         // capture typed/pasted text for code export (default; passwords masked)
    url: 'https://example.com',  // optional — navigate before the callback
    personality: 'careful',      // any PersonalityConfig
    seed: 'session-42',          // deterministic when set
    viewport: { width: 1920, height: 1080 }, // ephemeral/persistent only — CDP uses the real window
    headless: false,             // defaults false so you can watch the recording
    cursor: true,                // auto-install visible cursor overlay (default true)
    userDataDir: './.profile',   // persistent profile — stay logged in across runs
    cdpUrl: 'http://localhost:9222', // OR attach to a browser you launched (precedence)
    channel: 'chrome',           // launch installed Chrome instead of bundled Chromium
    launch: { args: ['--no-sandbox'] },  // forwarded to chromium.launch()
    context: { locale: 'en-US' },         // forwarded to browser.newContext()
  },
  async (human, page) => {
    // human is the @humanjs/playwright session — all primitives available
    // page is the underlying Playwright Page, in case you need it
    await human.click('#start');
    await human.scroll('#features');
    await human.read('#hero p');
  },
);
```

**No-video mode**: omit `output` entirely (or call `record(fn)` with no options). No screenshot polling, no temp files, no encoding overhead. The structured timeline is still captured.

## Recording a logged-in flow

By default each `record()` call uses a fresh, signed-out browser. Two ways to record something behind a login:

```ts
// Persistent profile — sign in once (in a headed run), reuse it forever
await record({ output: 'dashboard.mp4', userDataDir: './.humanjs-profile' }, async (human) => {
  await human.goto('https://app.example.com/dashboard');
});

// Or attach to a browser you already launched (real logins/tabs)
//   chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.humanjs-chrome"
await record({ output: 'flow.mp4', cdpUrl: 'http://localhost:9222' }, async (human) => {
  await human.goto('https://app.example.com/dashboard');
});
```

- **`userDataDir`** keeps cookies/logins across runs (a dedicated profile, starts empty).
- **`cdpUrl`** records a browser you launched yourself — its existing session. HumanJS **never closes** a browser it attached to; it only borrows it. Takes precedence over `userDataDir`.
- **`channel`** (`'chrome'` / `'msedge'`) swaps the binary but, on its own, still uses a fresh profile — pair it with `userDataDir` or `cdpUrl` for real logins.

> You can't attach to your everyday Chrome — it only exposes a CDP port when launched with `--remote-debugging-port`, and Chrome refuses that on the default profile. Use a dedicated `--user-data-dir` (you sign in once there), or `userDataDir` to let HumanJS manage one.

> **Recording resolution in CDP mode:** the attached browser's real window size wins — `viewport` is intentionally not applied. HumanJS is borrowing a window it doesn't own, and forcing a size would only *emulate* one (letterboxing the capture so the frames don't match what you see). Need a specific resolution? Launch the browser with `--window-size=1920,1080` to size the real window, or use the default/persistent modes where HumanJS owns the window and `viewport` applies directly.

## Quality presets

Pick the preset that matches the recording's purpose:

| Preset | Viewport | Capture | CRF | ffmpeg preset | tune | Use case |
|---|---|---|---|---|---|---|
| `'fast'` | 1280×720 | JPEG q=85 | 23 | `fast` | — | Iteration, throw-away recordings |
| `'standard'` | 1920×1080 | JPEG q=90 | 20 | `fast` | — | CI dashboards, casual demos |
| **`'high'`** (default) | 1920×1080 | JPEG q=95 | 18 | `slow` | `animation` | Marketing, tutorials, portfolio output |
| `'lossless'` | 1920×1080 | PNG | 12 | `veryslow` | `animation` | Archival, edit source |

Individual encoding knobs (`crf`, `preset`, `tune`) are exposed through `@humanjs/playwright`'s `Recording.toVideo()` for advanced use — see [`@humanjs/playwright`](../playwright#recording).

## When to use `record()` vs `human.record()`

| Use this | When |
|---|---|
| **`record()` from `@humanjs/recorder`** | You want lifecycle managed for you. The returned `Recording` still gives full programmatic access — `toTimeline()`, in-memory `.timeline`, `.durationMs`. |
| **`human.record(cb)` from `@humanjs/playwright`** | You already have a Playwright setup, need multi-page flows, or want to record a slice of a longer session. |

Both paths produce identical Recording objects — `record()` is a thin wrapper around `human.record()` plus lifecycle management.

## License

MIT
