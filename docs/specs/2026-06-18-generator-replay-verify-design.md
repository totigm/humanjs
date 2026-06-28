# In-app replay / verify — design

- **Date:** 2026-06-18
- **Status:** approved, pending implementation plan
- **Packages:** `@humanjs/playwright` (new public primitive), `@humanjs/generator` (consumes it)
- **Roadmap item:** generator v0.2+ — "In-app replay / verify"

## Summary

Add a **Run** button to the `@humanjs/generator` dashboard that replays the current
curated timeline in a fresh browser window and reports per-step pass/fail, closing the
record → edit → **green** loop.

The execution engine is extracted as a **public primitive** in `@humanjs/playwright`:
`replayTimeline(page, timeline, options?)`. The generator is a thin consumer of it.

## Decisions (resolved forks)

1. **In-process replay**, not spawning `playwright test` / a TS runner. The generator has
   `@humanjs/playwright` + `playwright` but **not** `@playwright/test` or `tsx`, and
   `npx @humanjs/generator` runs in an arbitrary folder that may lack the runner/deps.
   Replaying the timeline directly via `@humanjs/playwright` is robust everywhere, gives
   per-step feedback, and is watchable. It re-runs the timeline through the same code-path
   the exported test uses — not the literal exported file.
2. **Stop at the first failure** — halt on the first failing step, mark it red with its
   error, leave the rest "not run." Mirrors real Playwright test behavior; a failed step
   usually invalidates everything after it.
3. **Extract a public `replayTimeline` into `@humanjs/playwright`** (option B), rather than
   keeping a generator-internal executor. Reusable by any user/agent; keeps the generator
   thin; lives beside the codegen so the two mappings stay co-located.

## Architecture

### `@humanjs/playwright` — new public primitive

New module `src/recording/replay.ts`, sibling to `codegen.ts`, exported from the package root.

```ts
export async function replayTimeline(
  page: Page,
  timeline: Timeline | readonly TimelineEvent[],
  options?: ReplayOptions,
): Promise<ReplayResult>;

export interface ReplayOptions {
  personality?: PersonalityConfig;   // forwarded to createHuman
  speed?: Speed;                     // default 'human' (watchable)
  seed?: number | string;
  cursor?: boolean | InstallMouseHelperOptions;
  onStep?: (u: ReplayStepUpdate) => void;
  signal?: AbortSignal;              // abort an in-flight replay
}

export interface ReplayStepUpdate {
  index: number;
  type: string;                      // event type
  status: 'running' | 'pass' | 'fail';
  error?: string;
}

export interface ReplayStepResult {
  index: number;
  type: string;
  status: 'pass' | 'fail';
  error?: string;
}

export interface ReplayResult {
  status: 'pass' | 'fail';
  steps: ReplayStepResult[];
  failedIndex?: number;
  durationMs: number;
}
```

**Behavior:**

- Creates a `Human` internally via `createHuman(page, { personality, speed, seed, cursor })`.
  Defaults: `speed: 'human'` (watchable), cursor on (per `createHuman` default).
- Walks the events in order. Reports `onStep({ status: 'running' })` before each, then
  `'pass'` after it settles or `'fail'` (with `error`) if it throws — then stops.
- Reports by **index** (a `Timeline` has no stable ids — those belong to the generator).
- Respects `signal`: an abort mid-run rejects the in-flight step and stops cleanly.
- Always returns a `ReplayResult` (does not throw on a step failure; a thrown error means
  an infrastructure failure, e.g. the page closed).

**Event → action mapping (the runtime twin of `codegen.ts`'s `emitAction`):**

| Event | Action |
|---|---|
| `goto` | `human.goto(url)` |
| `click` / `rightClick` / `doubleClick` / `hover` / `move` | `human[type](target)` — `target` is a selector string or a `point(x, y)` → `{x,y}` (reuse codegen's point parser) |
| `check` / `uncheck` / `clear` | `human[type](target)` |
| `selectText` | `human.selectText(target, params.text ? { text } : undefined)` |
| `selectOption` | `human.selectOption(target, values)` |
| `upload` | `human.upload(target, files)` |
| `drag` | `human.drag(from, to)` |
| `type` / `paste` | `human[type](target, inputValue ?? '')` — masked/secret values were captured as `undefined` → typed as `''`, matching the exported test |
| `press` | `human.press(key)` |
| `scroll` | `human.scroll(target)` |
| `read` | `human.read(desc)`; word-count / `text:N chars` placeholders (no selector) are skipped, mirroring codegen emitting a comment |
| `sleep` | `sleep(ms)` |
| `reload` / `goBack` / `goForward` | `human.reload()` / `human.goBack()` / `human.goForward()` |
| `assert` | evaluated inline (see below); throws on mismatch |

The point-parsing helper currently inside `codegen.ts` is shared with `replay.ts` (extract
to a small internal helper so both consume one implementation).

**Assertion evaluation (no `@playwright/test`):** approximate the exported matchers via plain
Playwright APIs, aiming for "replay passes ≈ exported test passes":

- `visible` → `locator.waitFor({ state: 'visible' })` (throws on timeout).
- `text` → wait for the element, then compare normalized `textContent` to `value` (trimmed,
  whitespace-collapsed) — mirrors `toHaveText`. Throw on mismatch.
- `url` → after load settles, compare `page.url()` to `value`. Throw on mismatch.

The minor differences from `expect` matchers (no auto-retry on text/url) are documented in
the function's JSDoc and the README.

### `@humanjs/generator` — thin consumer

- **Clean context:** replay runs in a **fresh** `browser.newContext({ viewport: null })`
  with **no** capture init-scripts attached, so the replay can't re-record itself into the
  store. A separate window; closed in a `finally` (no leaked windows).
- **`run.ts` wiring:** handle `{ type: 'replay' }`:
  - Guard against concurrent runs (ignore Run while one is in flight).
  - Open the clean context + page, call
    `replayTimeline(page, store.list(), { personality, onStep, signal })`.
  - Map `onStep`'s `index` → the store step's `id` and broadcast `replayStep`.
  - Broadcast `replayStarted` first and `replayDone` (with overall status, `failedStepId`,
    `durationMs`) last. Close the context in `finally`.
- **Protocol** (`protocol.ts`):
  - Client → CLI: `{ type: 'replay' }` (and `{ type: 'cancelReplay' }` to abort — drives the
    `AbortSignal`).
  - CLI → dashboard:
    - `{ type: 'replayStarted' }`
    - `{ type: 'replayStep'; id: string; status: 'running' | 'pass' | 'fail'; error?: string }`
    - `{ type: 'replayDone'; status: 'pass' | 'fail'; failedStepId?: string; durationMs: number }`
- **Dashboard UI:**
  - A **Run** button near the Export / personality controls; disabled while replaying (shows
    a Cancel affordance during a run).
  - A per-step status badge in the step list (idle → running pulse → green check / red ✗),
    reusing the existing step-list styling.
  - An overall banner: "Replaying…" / "✓ Passed · N steps · Xs" / "✗ Failed at step K — \<error\>".
    Cleared at the start of each run.

## Data flow

```
Dashboard "Run"
  → WS { type: 'replay' }
  → CLI opens clean context + page
  → replayTimeline(page, steps, { onStep })
       → onStep(index, 'running'|'pass'|'fail')  ──→ CLI maps index→id ──→ WS replayStep ──→ dashboard badges
  → ReplayResult ──→ WS replayDone ──→ dashboard banner + re-enable Run
  → finally: close clean context
```

## Error handling

- Stop at the first failing step; report `failedStepId` + error; later steps stay "not run."
- Concurrent-run guard in the CLI.
- Clean context always closed in `finally` (no leaked windows), including on abort.
- A page crash / context-launch failure surfaces as a replay-level banner error
  (`replayDone` with `status: 'fail'` and no `failedStepId`, plus an error string).
- Normal Playwright action timeouts apply per step; no extra global timeout.

## Testing

- **`@humanjs/playwright` unit** (`replay.test.ts`): drive `replayTimeline` against a mock
  `Human` / page — assert each event type calls the right method with the right args; assert
  events evaluate correctly (pass + fail); first-failure stops the run and sets
  `failedIndex`; `onStep` fires `running` then `pass`/`fail`; `signal` aborts.
- **`@humanjs/playwright` integration** (mirrors `recording.integration.test.ts`): build a
  small timeline against a fixture page → replay → `status: 'pass'`; a broken selector →
  `status: 'fail'` at the right index.
- **`@humanjs/generator` integration**: record a fixture flow → trigger replay over WS →
  assert the `replayStep` / `replayDone` messages; a broken selector fails at the right step.

## Scope / non-goals (YAGNI)

- No replay video, no visual diffing, no retries — just run + per-step + overall result.
- No `Recording.replay(page)` convenience method yet (noted as a possible future; the
  standalone function covers the need).
- **No MCP tool.** Per the CLAUDE.md "consider the MCP surface" rule, `replayTimeline` is
  callback-shaped (`onStep`) and part of the `record()` / timeline family that the MCP
  surface deliberately does not mirror 1:1 (same reasoning as `record()`). It falls in the
  explicit skip categories, so no follow-up issue is opened.

## Release

- **Changesets:** `@humanjs/playwright` **minor** (new public API), `@humanjs/generator`
  **minor** (→ `0.2.0`). Core untouched (reuses existing `KnownActionType` values).
- **Docs:** add a `replayTimeline` line to the root `README.md` and the `CLAUDE.md`
  public-API shape; document it in the `@humanjs/playwright` README; tick the
  "In-app replay / verify" item in `packages/generator/ROADMAP.md`.

## Maintenance note

`replay.ts` and `codegen.ts` both translate the same `TimelineEvent` set (one to live calls,
one to source). They are co-located in `src/recording/` and share the point-parsing helper.
If they drift, a shared per-event registry could unify them — not done now (two small,
adjacent mappings are clear enough).
