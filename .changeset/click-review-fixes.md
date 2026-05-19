---
'@humanjs/playwright': minor
---

Refinements to `human.click()` from branch review:

- **New**: `CreateHumanOptions.initialMousePosition` — set the starting cursor position when you've already moved the cursor before creating the session. Defaults to `{ x: 0, y: 0 }`.
- **Fix**: In `speed: 'instant'`, the bounding box is now read before the click. Previously, if the click navigated away or unmounted the element, the post-click `boundingBox()` would return `null` and the recorded position fell back to the stale `lastMousePosition`.
- **Fix**: Mouse position commits before the click side-effect. Consecutive clicks now stay continuous even if a click throws (page closed, target removed mid-flight) — previously the next click's path would start from the previous position instead of the failed target.
