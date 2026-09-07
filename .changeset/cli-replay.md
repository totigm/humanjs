---
"@humanjs/cli": minor
---

Add `humanjs replay <timeline.json>`, and fix `--record` for the formats it already advertised.

`replayTimeline` has returned per-step pass/fail since the recorder shipped, but nothing outside the library could reach it. `replay` exposes it and **exits 1 on the first failed step**, naming the step that broke — so a recorded `.json` becomes a regression check that drops into CI with no test framework and no code:

```bash
humanjs demo https://app.example --record flow.json
humanjs replay flow.json --headless
```

The personality, speed and seed the timeline was captured with are reused unless overridden. A run recorded as `distracted` replays differently under `careful`, and `replayTimeline` on its own always starts from `careful`/`human`.

Two fixes found while building it:

`--record` only ever dispatched `.gif` against video, because that is all the recorder's own output handling distinguishes. `.json`, `.ts` and `.spec.ts` were routed to the video encoder and written as mp4s with a misleading extension, despite the help text promising all five. The CLI now owns the mapping, and validates the extension **before** launching a browser — a typo costs milliseconds instead of a full run.

`demo` passed a `Locator` to `hover`, and the recorder serialises a target with `String()`, so timelines captured from `demo` contained `locator('a[href]').first()` — not a selector, and unreplayable. Targets are now narrowed with Playwright's `>> nth=0`, which avoids strict-mode hangs *and* survives the round trip.

Also adds `--timeout <ms>`. Playwright's 30s default made a failing step take 32 seconds to report something it knew in two.
