---
"@humanjs/core": minor
---

Add `planScroll()` — the deterministic, axis-agnostic scroll planner that turns a (`from`, `to`) request into a sequence of `ScrollSegment`s shaped by a `ScrollProfile` and a seeded `Rng`.

The planner models real wheel motion: bell-curve velocity (sin(i/n × π) weights across segments), opt-in mid-scroll pauses, and an opt-in overshoot-and-correct phase where phase 1 goes past the target, the cursor "realizes" and pauses (~2.5× the configured pause), then phase 2 corrects back. Same seed produces identical segment sequences on every run and every platform — the math is pure, with no DOM and no `y`-axis bias in the names.

`Personality.scroll` is now a stable, publicly-exported shape (`ScrollProfile`) controlling segments-per-Kpx, segment delay + jitter, pause probability + duration, and overshoot probability + ratio. All four built-in presets (`careful`, `fast`, `distracted`, `precise`) ship sensible scroll defaults — `distracted` overshoots aggressively, `precise` never overshoots, `careful` and `fast` sit in between.

New public exports:

- `planScroll(from, to, profile, rng, options?) → readonly ScrollSegment[]`
- `ScrollProfile`, `ScrollSegment`, `PlanScrollOptions` types

Adapters (`@humanjs/playwright` ships next; future `@humanjs/puppeteer` will follow) build the I/O layer on top of this — the planner itself is reusable across any browser-driver that can deliver wheel events or assign `scrollLeft`/`scrollTop`.
