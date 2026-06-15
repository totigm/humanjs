---
"@humanjs/playwright": minor
---

Export `generateHumanJS` and `generatePlaywrightTest` from the package root. They turn a `Timeline` (the structured action log from `human.record()` / `rec.toTimeline()`) directly into a runnable HumanJS script or a `@humanjs/playwright/test` spec — the same code the `Recording` exporters emit, now callable on any `Timeline` you construct or load. This is the codegen entry point `@humanjs/generator` builds on, and it's useful standalone for tooling that produces timelines without running a live recording.
