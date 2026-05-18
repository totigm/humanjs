---
'@humanjs/playwright': minor
---

Add `human.click(target)` — the first real humanized action.

Resolves a selector string or `Locator`, picks a Gaussian-distributed point inside the target's bounding box, generates a Bezier path from the current mouse position to it, applies the `humanizePath` post-processor for bell-curve velocity and sub-pixel jitter, walks the mouse along the path with timing scaled by `Personality.mouse.travelTimeMs` and the session's `speed` mode, then clicks.

`speed: 'instant'` bypasses all humanization and uses Playwright's native `locator.click()`.

Click actions flow through the plugin pipeline as `{ type: 'click', params: { target } }`, with `onError` notified before the error re-throws.

Coming next on this branch: hover-before-click micro-pause and the `overshoot` + `misclick` realism layers.
