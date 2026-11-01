# @humanjs/cli

## 0.1.0

### Minor Changes

- a38cf74: Add `humanjs compare <url>` — the side-by-side, generated for your own site.
  
  Records the same tour twice, once as straight Playwright and once humanized, and stacks them horizontally into one video:
  
  ```bash
  npx @humanjs/cli compare https://your-app.com --record before-after.mp4
  ```
  
  The robotic lane is not a caricature of bad automation — it is `speed: 'instant'`, the documented mode that bypasses humanization entirely. Both lanes run the identical tour, so the only variable on screen is the motion, and no timing math is reimplemented to fake the comparison.
  
  The lanes rarely last the same time, which is the message rather than a problem: the shorter one is extended by holding its final frame, so the robotic side sits frozen while the other is still working. The summary names the ratio.
  
  Lane labels are painted with CSS through `body::before` rather than burned in with ffmpeg's `drawtext`, which needs a font file present on the host and fails differently on every machine.
- 434933d: Initial release — the `humanjs` command line.
  
  `humanjs demo <url>` drives any page the way a person would skim it: land, read the heading, scroll in stages, drift the cursor over a link. It is the ten-second answer to "is the motion actually convincing?", with no project to create first. It never clicks, because it runs on your site rather than ours.
  
  `humanjs run <script>` executes a HumanJS flow with the browser and the `Human` instance already wired, so the script is only the flow. `.ts` files run directly with no build step.
  
  Both accept `--record <file>`, which dispatches on the extension — `.mp4`, `.webm`, `.gif`, `.json`, `.ts`, or `.spec.ts` for a committable Playwright test — plus `--personality`, `--speed`, `--seed`, `--viewport` and `--headless`.
  
  Note that the unscoped `humanjs` name on npm belongs to an unrelated 2022 package, so the CLI is reached as `npx @humanjs/cli`. Installed globally, the binary is plain `humanjs`.
- 94aaaaf: Add media emulation flags to every command, and a `check` command that reports which ones a page responds to.
  
  `--reduced-motion`, `--color-scheme <light|dark>` and `--forced-colors` are applied before the first navigation, so a page that reads the preference once at boot still sees it. Reduced motion is the one that matters: it cannot normally be exercised without changing an OS setting, so that branch ships unverified — and it fails quietly, since the people who depend on it are the least likely to report it. Paired with `--record`, the path can finally be watched:
  
  ```bash
  humanjs demo https://your-app.com --reduced-motion --record motion.mp4
  ```
  
  `humanjs check <url>` renders the page under baseline, dark, light, forced-colors and reduced-motion, writes a screenshot of each, and compares them. Four screenshots alone are four screenshots someone has to eyeball; the comparison is the value — a condition rendering byte-identical to baseline is a page that very likely has no branch for it.
  
  Reduced motion is excluded from that verdict on purpose. The difference there is in movement, not layout, so a still frame cannot settle it either way; the command says so and points at the recording route instead of implying a conclusion it cannot support.
- 1598660: Add `humanjs replay <timeline.json>`, and fix `--record` for the formats it already advertised.
  
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
- 7145c1c: `--viewport` accepts a list, and `demo` reports when it is not recording.
  
  Passing `--viewport 1440x900,390x844` runs the command once per size, appending the size to each output filename — so checking a desktop and a phone layout is one invocation rather than two that have to be kept in sync by hand. It applies to every command, `replay` included, which makes a responsive regression check a single line in CI.
  
  Filenames are suffixed before the extension, and `.spec.ts` is handled as the two-part extension it is: `flow.spec.ts` becomes `flow-390x844.spec.ts`, not `flow.spec-390x844.ts` — the latter would quietly demote a Playwright test into a standalone script. A single viewport still writes the exact filename requested, with no suffix and no banner.
  
  Separately, `demo` printed nothing at all when run without `--record`, which reads as though it never ran — especially headless, where there is no window to watch either. It now reports the URL, the viewport and the elapsed time.
