---
"@humanjs/playwright": minor
---

`human.click()` and `human.rightClick()` now accept a raw `Point` (`{ x, y }`), not just a selector or `Locator` — matching `move()` and `drag()`, which already did.

This is the Computer-Use-style fallback: when you can *see* a control (in a screenshot, say) but have no clean selector for it — icon-only buttons, canvas, SVG, custom widgets — click the visible coordinates directly:

```ts
await human.click({ x: 640, y: 360 });        // humanized walk, then click the point
await human.rightClick({ x: 640, y: 360 });   // same, context-menu button
```

Element targets are unchanged: the click point is still Gaussian-distributed inside the box, auto-scroll still fires, and the misclick beat still picks a near-miss "outside the box." For a raw `Point`, the exact coordinates are clicked, no auto-scroll (the caller owns the point), and the misclick beat near-misses "around the point" — the same shape `drag` already uses for raw-coordinate endpoints.

In `speed: 'instant'`, a `Point` dispatches a single `mouse.click()` at the coordinates; element targets keep using Playwright's native `locator.click()`.

This lands primarily to back `@humanjs/mcp`'s coordinate-click fallback, but it's a coherent library improvement on its own — `click` accepting a `Point` was a gap given `move` and `drag` already did.
