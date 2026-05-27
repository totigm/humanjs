---
"@humanjs/playwright": patch
---

`drag` now pre-scrolls the page when the Bezier curve between the two endpoints would extrude past a viewport edge — fixing the case where Chrome's native edge-scroll-during-drag behavior walks the page wildly when the cursor approaches a viewport edge with the mouse button held.

## The problem

`human.drag(from, to)` walks a humanized Bezier curve between the endpoints with the button held. The curve's control points are perpendicular-offset by up to `distance × curvature`, so even when both endpoints are individually inside the viewport, the curve between them can pop out — and Chrome interprets that as "user dragging toward the edge, scroll to follow" and walks the page hundreds of pixels.

Symptom: dragging a horizontal slider near the viewport bottom would scroll the whole page to the bottom mid-drag, leaving the user (or test) confused about what just happened.

## The fix

Before the drag begins, the library computes a conservative bounding box for the path (the from→to line inflated by `distance × curvature` on each side). If that box exceeds the viewport vertically, the library scrolls the page **just enough** to bring it back inside, plus a 20 px safety margin. After the scroll both endpoints are re-resolved (they shifted with the page) and the drag proceeds with normal humanized motion.

The scroll itself is humanized (`block: 'center'`-style behavior is not used here — we use the existing humanized scroll-by-delta path), so the page motion looks like a real user shifting the view to make room before the drag.

## Scope: element × element only

The curve-aware pre-scroll only fires when **both** endpoints are element-bound (`Locator` / selector). For raw-`Point` endpoints (e.g. `human.drag('#thumb', { x: 800, y: 450 })`), the caller specified an explicit viewport coordinate — scrolling the page would shift the element endpoint relative to that coordinate and turn the drag diagonal. The library defers to the caller in that case; the canonical pattern for mixed endpoints is to scroll explicitly before the drag (see `examples/primitives-demo.ts` step 4 for the canvas/SVG-style slider drag).

## Determinism

The scroll fires deterministically based on the resolved endpoint coordinates, the personality's curvature, and the viewport size — same seed produces the same scroll decision. After the scroll, the endpoint re-resolution consumes additional RNG values (one extra Gaussian per element-bound endpoint), so seeded sessions that previously triggered no scroll and now do will see different downstream cursor coordinates. Action outcomes (mousedown / mouseup positions, target elements) are unchanged.

## Skipped automatically

- One or both endpoints is a raw `Point` (deferred to caller, see above).
- `speed: 'instant'` (the whole humanized drag path is bypassed).
- The drag's conservative bounding box already fits in the viewport with margin to spare.
- The path is taller than the viewport (no scroll position can fit it; the library picks the worst overflow and lives with the partial fix).
