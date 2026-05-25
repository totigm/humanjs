---
"@humanjs/playwright": patch
---

Two hardening fixes surfaced during branch review of the recorder pillar:

- **`installMouseHelper(target)` is now idempotent.** A second call on the same `Page` or `BrowserContext` is a no-op instead of stacking duplicate `domcontentloaded` and `'page'` listeners. The in-page DOM guard already made the install script itself a no-op, but the listener accumulation meant N round-trips to the browser per navigation after N installs. Now an early-return guard (via `Symbol.for('@humanjs/playwright:mouse-helper:installed')` stashed on the target) skips repeat work.

- **Capture loop write failures no longer poison the queue.** Previously, a single failed `writeFile` (e.g. disk pressure mid-recording) would reject every subsequent write via promise-chain propagation, which in turn made `human.record()`'s `abort()` path throw before its `rm()` cleanup — leaking the temp directory and masking the original error. Each write now fails independently: one frame is dropped, a warning is logged, and the rest of the capture + cleanup proceeds normally. The chain (`pendingChain`) was replaced with an array fed to `Promise.allSettled` in the loop's settle step.

Neither fix changes the public API. They make existing behavior robust under failure conditions that were unlikely but unrecoverable.
