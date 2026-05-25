---
"@humanjs/core": patch
"@humanjs/playwright": minor
"@humanjs/recorder": minor
---

Add `Recording.toGif(path, options?)` for animated-GIF export, and make exporters repeatable.

```ts
const rec = await record({ output: 'demo.mp4' }, async (human) => {
  await human.goto('https://humanjs.dev');
  await human.click('#cta');
});
await rec.toGif('demo.gif', { fps: 15, width: 720 });
await rec.toTimeline('demo.json');
await rec.dispose();
```

Palette-optimized GIF output (per-recording `palettegen` + `paletteuse`, Bayer dither) so README/PR/Slack-embedded GIFs stay sharp at small file sizes. `record()` from `@humanjs/recorder` auto-dispatches to `toGif` when `output` has a `.gif` extension.

`Recording.toVideo()` and `Recording.toGif()` are now **repeatable and interleavable** — they read the captured frames, they don't consume them. Captured frames are swept automatically by a `process.on('exit')` handler installed on first use, so casual scripts don't need to call `dispose()` at all. For predictable mid-process cleanup (long-running services, batch jobs), call `await rec.dispose()` explicitly, or use `await using rec = await record(...)` (TS ≥ 5.2 / Node ≥ 20.4) — `Recording` implements `Symbol.asyncDispose`.

Previously each exporter was single-use and the two were mutually exclusive — that was an over-eager cleanup choice, not a real constraint.

Also fixes a timeline-fidelity bug: `human.sleep(ms)` now emits a `'sleep'` action through the plugin / recording pipeline (added to `KnownActionType` in `@humanjs/core`). Previously, pauses were invisible to the recorded timeline, which would have broken upcoming exporters (`toPlaywright`, `toHumanJS`) that replay timelines.
