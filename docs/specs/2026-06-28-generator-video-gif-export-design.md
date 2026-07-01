# Video + GIF export — design

- **Date:** 2026-06-28
- **Status:** approved, pending implementation plan
- **Packages:** `@humanjs/playwright` (new public primitive), `@humanjs/generator` (consumes it)
- **Roadmap item:** generator v0.2+ — "Video + GIF export"

## Summary

A generator session can already export a humanized test (`replayTimeline` / Run). Now it
also exports an **`.mp4` / `.gif` of a clean replay** of the curated flow — a polished demo
asset (the project's hero side-by-side video + tutorial content), with no fumbles, mis-clicks,
or thinking pauses.

The engine is a new public primitive, **`recordReplay`**, that composes three things we
already have: `replayTimeline` (replay) + `startCapture` (frame poller) + `Recording`
(ffmpeg assembly). It is symmetric with `human.record()`: that captures a *live callback*;
`recordReplay` captures a *replayed timeline*.

## Decisions (resolved forks)

1. **Clean replay capture**, not live capture. Re-run the final, edited timeline in a fresh
   window at human pace and capture frames — a polished demo, not the messy live session.
   Reuses `replayTimeline` and adds no screenshot overhead to the live recording session.
2. **Public `recordReplay` primitive** in `@humanjs/playwright` (not generator-internal
   orchestration). Reusable by anyone, symmetric with `human.record()`, keeps the generator
   thin, and lives beside `replayTimeline`. Same pattern chosen for `replayTimeline`.

## Architecture

### `@humanjs/playwright` — `recordReplay`

New code in `src/recording/replay.ts` (beside `replayTimeline`), exported from the package root.

```ts
export async function recordReplay(
  page: Page,
  timeline: Timeline | readonly TimelineEvent[],
  options?: RecordReplayOptions,
): Promise<Recording>;

export interface RecordReplayOptions extends ReplayOptions {
  // ReplayOptions: personality, speed, seed, cursor, onStep, signal — forwarded to replayTimeline.
  /** Capture rate (frames/sec). Default 30. */
  fps?: number;
  /** JPEG frame quality (0-100). Default 95. */
  quality?: number;
}
```

**Behavior:**

1. `startCapture(page, { fps, quality })` — the internal timer-based screenshot poller.
2. `replayTimeline(page, timeline, options)` — replays with humanized motion. The **cursor
   overlay is on** (it's the point — the video shows the humanized cursor moving). If
   `replayTimeline` throws (infra failure / abort), `capture.abort()` then rethrow.
3. `capture.stop()` → `CaptureResult` (frames on disk).
4. Wrap in a `Recording(captureResult, startedAtMs, stoppedAtMs, timelineSource)` and return it.
   The caller exports with the existing `rec.toVideo('demo.mp4')` / `rec.toGif('demo.gif')`,
   then `rec.dispose()` (or relies on sweep-on-exit).

`Recording` metadata (`personality` / `seed` / `speed` / `name`) is derived from the `Timeline`
when one is passed, else from `options` (string personality), else defaults
(`'careful'` / `null` / `'human'`).

**Replay outcome:** `recordReplay` returns the `Recording` regardless of whether the replay
passed or failed — the captured frames cover whatever ran (a failed step means the video stops
there). Callers that care pass `onStep` to observe failures; the JSDoc tells them to verify with
`replayTimeline` / Run first. (`recordReplay` returns a `Recording`, not the `ReplayResult`, to
stay symmetric with `human.record()`.)

The caller owns `page`'s lifecycle. `toVideo`/`toGif` read the captured frames from disk, so the
page can be closed before assembling.

### `@humanjs/generator` — thin consumer

- **UI:** two toolbar buttons, **Export .mp4** and **Export .gif**, beside the existing
  `Export .spec.ts` / `Export .ts`.
- **Protocol:** extend the existing export command's format union:
  `{ type: 'export'; format: 'spec' | 'script' | 'mp4' | 'gif' }`.
- **`run.ts`:** for `mp4` / `gif`, open the same fresh, capture-free window Run uses, call
  `recordReplay(page, store.list(), { personality })`, then `rec.toVideo` / `rec.toGif` to a
  cwd file (`humanjs-recording.mp4` / `humanjs-recording.gif`), `rec.dispose()`, close the
  window, and broadcast the existing `exported` (path) message. The user **watches the clean
  replay** happen in the popped window, then gets the file.
- **Concurrency:** reuse one busy guard so Run and a video export can't run at once (extend the
  existing `replayController` guard into a shared "a replay/export is in flight" flag).
- The spec/script export path is unchanged (synchronous codegen write).

## Data flow

```
Dashboard "Export .gif"
  → WS { type: 'export', format: 'gif' }
  → CLI opens a fresh capture-free window
  → recordReplay(page, steps)  ── startCapture → replayTimeline (visible) → capture.stop → Recording
  → rec.toGif(cwd/humanjs-recording.gif)  (ffmpeg assembles frames)
  → rec.dispose(); close window
  → WS { type: 'exported', path } ── dashboard shows "Saved …"
```

## Error handling

- A replay/capture/ffmpeg failure → broadcast `{ type: 'exportFailed', format, error }` → a
  dashboard banner. The window is always closed and frames always released (`finally` +
  `rec.dispose()` / `capture.abort()`).
- No new global timeout; Playwright action timeouts apply per replayed step. A long replay (it
  runs at human pace) is expected — the visible window is the progress indicator.
- Concurrency guard rejects a second export/Run while one is in flight (no-op, like Run).

## Dependencies

No new dependencies. `Recording.toVideo` / `toGif` use `ffmpeg-static`, already a dependency of
`@humanjs/playwright`, which `@humanjs/generator` already depends on.

## Testing

- **`@humanjs/playwright` integration** (`replay.integration.test.ts`, real browser + ffmpeg):
  `recordReplay` against a fixture page returns a `Recording` with `hasVideo === true` and
  frames > 0; `toGif()` / `toVideo()` write non-empty files; a passing replay produces a full
  video. Slow — lives with the other integration tests.
- **`@humanjs/generator`:** exporting `gif` / `mp4` over WS produces a file on disk and emits
  `exported`; a broken selector surfaces `exportFailed`.

## Scope / non-goals (YAGNI)

- mp4 + gif only; write to cwd like the test exports.
- No in-app video preview, no resolution/crop UI, no live capture.
- **No MCP tool** — `recordReplay` is callback-shaped (`onStep`) and part of the `record()` /
  timeline family the MCP surface deliberately doesn't mirror (same rationale as `record()` and
  `replayTimeline`).

## Release

- **Changesets:** `@humanjs/playwright` **minor** (new `recordReplay` public API),
  `@humanjs/generator` **minor** (→ `0.3.0`).
- **Docs:** add `recordReplay` to the root `README.md`, the `CLAUDE.md` public-API shape, and the
  `@humanjs/playwright` README (next to `replayTimeline`); document the generator's mp4/gif
  export in the generator README; tick "Video + GIF export" in `packages/generator/ROADMAP.md`.

## Maintenance note

`recordReplay` sits beside `replayTimeline` in `src/recording/replay.ts` and reuses
`startCapture` (capture.ts) + `Recording` (index.ts) without new coupling — it's pure
composition of existing units.
