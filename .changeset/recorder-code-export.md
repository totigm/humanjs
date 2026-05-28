---
"@humanjs/playwright": minor
"@humanjs/recorder": minor
"@humanjs/mcp": minor
---

Recorder code export — turn a recorded session into runnable code.

- **`Recording.toHumanJS(path)`** — writes a standalone HumanJS script (`createHuman` + `human.*`) that replays the session.
- **`Recording.toPlaywright(path, options?)`** — writes a `@playwright/test` spec that drives the page through HumanJS, so the generated test runs humanized too. It's built to *be* a test: runs instant in CI / recorded speed locally, drops timing `sleep()`s (`{ keepSleeps: true }` to keep them), titles the test from the recording's `name` (or `{ title }`), and derives the assertions it safely can (`toBeVisible` from reads, `toHaveValue` from captured inputs).

Both are available on the `Recording` returned by `human.record()` and by `@humanjs/recorder`'s `record()`. String selectors round-trip verbatim; raw `point(x, y)` targets are emitted with a flag comment (locator/point → selector synthesis is a planned follow-up).

`@humanjs/mcp`'s `human_stop_recording` now accepts these formats too — a `.ts` filename writes a HumanJS script, `.spec.ts` / `.test.ts` writes a Playwright test — so an AI agent can record a flow and emit a ready-to-commit test directly.

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
