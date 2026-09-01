---
"@humanjs/cli": minor
---

Initial release — the `humanjs` command line.

`humanjs demo <url>` drives any page the way a person would skim it: land, read the heading, scroll in stages, drift the cursor over a link. It is the ten-second answer to "is the motion actually convincing?", with no project to create first. It never clicks, because it runs on your site rather than ours.

`humanjs run <script>` executes a HumanJS flow with the browser and the `Human` instance already wired, so the script is only the flow. `.ts` files run directly with no build step.

Both accept `--record <file>`, which dispatches on the extension — `.mp4`, `.webm`, `.gif`, `.json`, `.ts`, or `.spec.ts` for a committable Playwright test — plus `--personality`, `--speed`, `--seed`, `--viewport` and `--headless`.

Note that the unscoped `humanjs` name on npm belongs to an unrelated 2022 package, so the CLI is reached as `npx @humanjs/cli`. Installed globally, the binary is plain `humanjs`.
