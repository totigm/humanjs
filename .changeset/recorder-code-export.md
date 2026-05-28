---
"@humanjs/playwright": minor
"@humanjs/recorder": minor
---

Recorder code export — turn a recorded session into runnable code.

- **`Recording.toHumanJS(path)`** — writes a standalone HumanJS script (`createHuman` + `human.*`) that replays the session.
- **`Recording.toPlaywright(path)`** — writes a `@playwright/test` spec that drives the page through HumanJS, so the generated test runs humanized too.

Both are available on the `Recording` returned by `human.record()` and by `@humanjs/recorder`'s `record()`. String selectors round-trip verbatim; raw `point(x, y)` targets are emitted with a flag comment (locator/point → selector synthesis is a planned follow-up).

- **`captureInputs`** (new `human.record()` / `record()` option, default `true`) — records the actual typed/pasted text into the timeline so it flows into exported code. Values typed into `input[type="password"]` are always masked; set `captureInputs: false` to record none. Captured values land in the timeline JSON and exported code — treat those artifacts accordingly.
- `TimelineEvent` gains an optional `inputValue` field carrying the captured text for `type`/`paste`.

```ts
const rec = await human.record(async () => {
  await human.goto('https://example.com');
  await human.type('Email', 'gonzalo@example.com');
});

await rec.toHumanJS('session.ts');         // runnable script
await rec.toPlaywright('session.spec.ts'); // @playwright/test spec
```
