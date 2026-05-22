---
"@humanjs/playwright": minor
---

Add `human.scroll(target?, options?)` — the scroll pillar, built on top of `planScroll` from `@humanjs/core`.

```ts
await human.scroll();                                     // 'natural': one viewport
await human.scroll('top');                                // back to the top
await human.scroll('end');                                // all the way down
await human.scroll('#pricing');                           // selector
await human.scroll(locator);                              // Locator
await human.scroll({ by: 480 });                          // relative offset
await human.scroll({ to: 1200 });                         // absolute position
await human.scroll('#card', { axis: 'x' });               // horizontal
await human.scroll('#row', { within: '.scroller' });      // inside a container
await human.scroll('#hero', { block: 'nearest' });        // minimum scroll
await human.scroll('#testimonials', { overshoot: true }); // force overshoot
```

Routes between window and container, X and Y axis. Window scrolls dispatch real `page.mouse.wheel()` events so page-level wheel listeners fire. Container scrolls assign `scrollLeft` / `scrollTop` directly because Playwright's wheel doesn't reliably route into nested overflow scrollers.

`block` mirrors `Element.scrollIntoView({ block })`: `'start'` (default), `'center'`, `'end'`, and `'nearest'` — `'nearest'` does the minimum scroll, no-opping if the element is already fully visible along the chosen axis.

Returns `ScrollResult` with `{ from, to, distance, durationMs }` so observers know where the scroll landed. Each scroll flows through the plugin pipeline as `{ type: 'scroll', params: { target } }`.

`speed: 'instant'` bypasses the planner and uses Playwright's native scroll. In `human` and `fast` modes, scrolls are deterministic given a session seed.

New public exports: `ScrollTarget`, `ScrollOptions`, `ScrollResult` (plus a re-export of `ScrollProfile` from `@humanjs/core`).
