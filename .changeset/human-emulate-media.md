---
"@humanjs/playwright": minor
---

Add `human.emulateMedia(options)`, forwarding to Playwright's `page.emulateMedia`.

Covers `prefers-reduced-motion`, `prefers-color-scheme`, `forced-colors`, `prefers-contrast` and print media. The reduced-motion path is the motivating case: it cannot normally be exercised without changing an OS setting, so it tends to ship unverified even where it was written carefully — and it fails silently, because the users who depend on it are the least likely to report it.

Not a humanized action; no plugin events fire and `speed` does not affect it. This brings the library to parity with the `human_emulate_media` MCP tool.
