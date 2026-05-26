---
"@humanjs/playwright": patch
---

Mouse primitives now auto-scroll the target into view before interacting with it.

Before this fix, `human.click('#below-the-fold')` (and the same for `hover`, `rightClick`, `drag`, `type`, `paste`, `move`) read the element's viewport-relative bounding box and fed those coordinates straight into `page.mouse.move/click`. When the element lived below the fold, the resolved `y` exceeded the viewport height and the mouse dispatched off-screen — the click silently missed and the test failed in a confusing way several actions later.

The fix lives in the shared locator resolver: when the box's center isn't inside the viewport, the resolver triggers a humanized scroll first (or `scrollIntoViewIfNeeded` in `speed: 'instant'` mode), then re-reads the box. `block: 'center'` lands the target in the middle of the viewport — the position from which a real user would actually look at and interact with an element. Earlier iterations used `'nearest'` (minimum-scroll), but that left the target clinging to the viewport edge, which read as robotic. Raw `Point` targets (`human.drag({ x, y }, ...)`, `human.move({ x, y })`) bypass auto-scroll entirely; explicit coordinates are the caller's responsibility.

This matches what Playwright's own `locator.click()` does internally — every previous `Human` action that went through Playwright's actionability checks already auto-scrolled. The bug was specific to our humanized paths reading coordinates without the same guard.
