# @humanjs/cli

<p>
  <a href="https://www.npmjs.com/package/@humanjs/cli"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/cli"></a>
  <a href="https://www.npmjs.com/package/@humanjs/cli"><img alt="downloads" src="https://img.shields.io/npm/dt/@humanjs/cli"></a>
  <a href="https://github.com/totigm/humanjs"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-totigm%2Fhumanjs-181717?logo=github"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/totigm/humanjs/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/cli"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
</p>

Command line for [HumanJS](https://humanjs.dev). Watch humanized browser automation on any page, compare it against plain Playwright, run HumanJS scripts, and replay a recorded session as a regression check — without creating a project.

```bash
npx @humanjs/cli demo https://example.com
```

A browser opens, lands on the page, reads the heading, scrolls in stages, and drifts the cursor over a link — the way a person skims. That is the whole pitch, in one command, before you write a line of code.

> **On the command name.** The unscoped `humanjs` name on npm belongs to an unrelated package from 2022, so `npx humanjs` does **not** reach this CLI. Use `npx @humanjs/cli`. Installed (`npm i -g @humanjs/cli`), the binary is plain `humanjs`.

## Commands

### `demo <url>`

Drives any page the way a person would skim it.

```bash
npx @humanjs/cli demo https://your-site.com
npx @humanjs/cli demo https://your-site.com --record tour.gif
```

Every step is optional at runtime: a page with no heading, nothing to scroll, or no links simply gets fewer steps rather than an error. **It never clicks** — it runs on your site, not ours, so it will not navigate away, submit a form, or fire a side effect.

### `compare <url>`

Records the same tour twice — once as straight Playwright, once humanized — and stacks them side by side into one video.

```bash
npx @humanjs/cli compare https://tu-app.com --record before-after.mp4
```

```
recording the Playwright lane (speed: instant)…
recording the HumanJS lane (careful)…
combining…

  before-after.mp4
  Playwright 1.9s · HumanJS 8.6s (4.4× longer, and that is the point)
```

The robotic lane is not a caricature: it is `speed: 'instant'`, the documented mode that bypasses humanization and runs as plain Playwright. Both lanes execute the identical tour, so the only variable on screen is the motion.

The lanes rarely last the same time, and that asymmetry is the message — the robotic side finishes early and **holds on its final frame** while the other is still moving. Writes `humanjs-compare.mp4` unless you pass `--record`.

### `replay <timeline.json>`

Re-runs a recorded session and reports whether it still works.

```bash
npx @humanjs/cli demo https://tu-app.com --record flow.json   # capture
npx @humanjs/cli replay flow.json --headless                  # verify
```

```
replaying flow.json — 6 steps (careful, human)

  ✓  1  goto
  ✓  2  sleep
  ✗  3  hover
        locator.boundingBox: Timeout 3000ms exceeded.

  FAIL  step 3 of 6 (hover) · 5.3s
```

**It exits 1 on the first failed step**, which is the whole point — it drops into a CI job with no test framework and no code. A clean run exits 0.

The personality, speed and seed the timeline was recorded with are reused unless you override them. A run captured as `distracted` replays differently under `careful`, so reproducing the original conditions is the only sane default for a regression check.

`--record` works here too, so a replay can produce the video: `replay flow.json --record regression.mp4`.

### `run <script>`

Runs a HumanJS flow with the browser and the `Human` instance already wired. The script is only the flow:

```ts
// flow.ts
export default async (human) => {
  await human.goto('https://example.com');
  await human.type('#email', 'you@company.com');
  await human.click('text=Sign in');
};
```

```bash
npx @humanjs/cli run flow.ts
npx @humanjs/cli run flow.ts --record login.spec.ts --headless
```

`.ts` files run directly — no build step, no tsconfig. A named `run` export works as well as the default one. The flow receives `(human, page)`, so the raw Playwright `Page` is there when you need it.

## Options

| Option | Purpose |
|---|---|
| `--record <file>` | Also record the session. The extension picks the format: `.mp4` `.webm` `.gif` `.json` (timeline) `.ts` (HumanJS script) `.spec.ts` (Playwright test) |
| `--personality <name>` | `careful` · `fast` · `distracted` · `precise` (default `careful`) |
| `--speed <pace>` | `human` · `fast` · `instant` (default `human`) |
| `--seed <string>` | Deterministic run — same seed, same trajectory, every time |
| `--viewport <WxH>` | Browser size (default `1280x800`; `1440×900` works too). Accepts a comma-separated list to sweep sizes — see below |
| `--timeout <ms>` | Per-action timeout. Playwright's default is 30000, which makes a failing CI step wait half a minute to report something it knew immediately |
| `--headless` | Run without a window. The default is headed, because the point of `demo` is watching it |
| `-h`, `--help` | Usage |
| `-v`, `--version` | Version |

## Checking several sizes at once

`--viewport` takes a list, and the command runs once per size with the size appended to each output filename:

```bash
npx @humanjs/cli demo https://tu-app.com --viewport 1440x900,390x844 --record tour.gif
# → tour-1440x900.gif
# → tour-390x844.gif
```

It applies to every command, so a responsive regression check is one invocation rather than two that someone has to remember to keep in sync:

```bash
npx @humanjs/cli replay flow.json --viewport 1440x900,390x844 --headless
```

A single size behaves exactly as before — no banner, and the output keeps the filename you asked for.

## Record once, verify forever

`--record` and `replay` are two halves of one loop. Record a flow to `.json`, and every later run of `replay` checks that it still works — no test framework, no code, and a non-zero exit when it breaks:

```bash
npx @humanjs/cli run checkout.ts --record checkout.json --headless
# ...later, in CI
npx @humanjs/cli replay checkout.json --headless --timeout 5000
```

The `.spec.ts` export below is the other route: it hands you a `@playwright/test` file if you would rather own the test. `replay` is the route that needs nothing else installed.

## Recording a flow as a test

`--record` dispatches on the extension, so the same run can produce a video for a README or a committable test:

```bash
npx @humanjs/cli run checkout.ts --record checkout.spec.ts --headless
```

That writes a `@playwright/test` spec with assertions derived from the run. Typed text is captured so the test is runnable — **except password fields, which are always masked**. That is deliberate: read the value from an env var in the generated file rather than pasting the secret back in.

## Honest limits

- Built on Playwright — humanizes it, does not replace it. Will not defeat sophisticated bot detection, and is not meant to.
- `demo` runs against pages it has never seen. It is defensive by design, so on an unusual layout it does less rather than failing.
- Recording video or GIF needs `ffmpeg`, bundled via `ffmpeg-static`. `.json` timelines and code exports have no such dependency.
- `compare` runs the tour twice and then encodes, so it takes roughly twice as long as `demo` plus the stack.

## License

MIT
