---
"@humanjs/cli": minor
---

`--viewport` accepts a list, and `demo` reports when it is not recording.

Passing `--viewport 1440x900,390x844` runs the command once per size, appending the size to each output filename — so checking a desktop and a phone layout is one invocation rather than two that have to be kept in sync by hand. It applies to every command, `replay` included, which makes a responsive regression check a single line in CI.

Filenames are suffixed before the extension, and `.spec.ts` is handled as the two-part extension it is: `flow.spec.ts` becomes `flow-390x844.spec.ts`, not `flow.spec-390x844.ts` — the latter would quietly demote a Playwright test into a standalone script. A single viewport still writes the exact filename requested, with no suffix and no banner.

Separately, `demo` printed nothing at all when run without `--record`, which reads as though it never ran — especially headless, where there is no window to watch either. It now reports the URL, the viewport and the elapsed time.
