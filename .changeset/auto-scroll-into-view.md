---
"@humanjs/playwright": patch
---

Mouse primitives now auto-scroll the target into view before interacting with it.

Before this fix, `human.click('#below-the-fold')` (and the same for `hover`, `rightClick`, `drag`, `type`, `paste`, `move`) read the element's viewport-relative bounding box and fed those coordinates straight into `page.mouse.move/click`. When the element lived below the fold, the resolved `y` exceeded the viewport height and the mouse dispatched off-screen — the click silently missed and the test failed in a confusing way several actions later.

The fix lives in the shared locator resolver: when the box's center isn't inside the viewport, the resolver triggers a humanized scroll first (or `scrollIntoViewIfNeeded` in `speed: 'instant'` mode), then re-reads the box. `block: 'nearest'` is used so the page only scrolls as far as it needs to — the minimum-disturbance shape a real user produces. Raw `Point` targets (`human.drag({ x, y }, ...)`, `human.move({ x, y })`) bypass auto-scroll entirely; explicit coordinates are the caller's responsibility.

This matches what Playwright's own `locator.click()` does internally — every previous `Human` action that went through Playwright's actionability checks already auto-scrolled. The bug was specific to our humanized paths reading coordinates without the same guard.
