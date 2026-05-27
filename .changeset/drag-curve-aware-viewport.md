---
"@humanjs/playwright": patch
---

`drag` is more robust against Chrome's native edge-scroll-during-drag behavior, fixing two related cases where the page would scroll wildly mid-drag.

## What's fixed

**1. Mixed-endpoint drags now stay geometrically consistent across auto-scroll.** When a drag is from an element to a raw `Point` (`human.drag('#slider-thumb', { x, y })`) and the element auto-scrolls into view, the raw `Point` now shifts by the same scroll delta. This preserves the "same visual position" relationship the caller intended — callers usually compute raw Points from element positions they see right now, so when the page scrolls during resolution, the Point should follow. Otherwise a horizontal slider drag silently becomes diagonal as soon as the thumb auto-scrolls and the raw Point stays put — and the cursor walking off-viewport then triggers native edge-scroll.

**2. Element×element drags pre-scroll when the Bezier curve would extrude.** Both endpoints might be individually in-viewport (so per-endpoint auto-scroll didn't fire), yet the curve between them — control points perpendicular-offset by up to `distance × curvature` — can pop out while the mouse button is held. The library now computes a conservative bounding box for the path (the from→to line inflated by `distance × curvature` on each side) and, if it exceeds the viewport, pre-scrolls just enough plus a 20 px safety margin to bring it back inside.

## How it composes

The resolve-time shift runs first (any auto-scroll from `readBoxWithAutoScroll` shifts raw Points by its delta). Then the curve-aware check runs for element×element drags. In practice these two cover the realistic cases:

| Drag shape | Behavior |
|---|---|
| element → element | Resolve-time auto-scroll if either is off-viewport, plus curve-aware pre-scroll if the curve still wouldn't fit |
| element → raw Point | Resolve-time auto-scroll for the element brings it in view; raw Point shifts by the scroll delta; drag stays geometrically consistent |
| raw Point → element | Symmetric |
| raw Point → raw Point | No auto-scroll (caller owns both coordinates) — the curve-aware check doesn't fire either, because any additional scroll would shift both points further and chase its own tail |

## Examples

**The slider case** (the motivating example): `human.drag('#slider-thumb', { x: 800, y: thumb.y + 11 })` where the thumb is below the viewport now works without an explicit pre-scroll. The thumb auto-scrolls into the viewport center, the raw Point's y shifts by the same delta to stay aligned with the (now-centered) thumb, and the drag walks horizontally as the caller intended.

**Element×element near an edge**: dragging a card from a slot near the viewport bottom to another nearby slot now pre-scrolls before mousedown when the path would dip out of viewport. Previously this triggered edge-scroll mid-drag and walked the page hundreds of pixels.

## Determinism

The scroll fires deterministically based on resolved endpoint coordinates, personality curvature, and viewport size — same seed produces the same scroll decision. After the scroll, element endpoints are re-resolved (one extra Gaussian per element-bound endpoint) and raw Points are arithmetically adjusted (no extra RNG). Seeded sessions that previously triggered no scroll and now do will see different downstream cursor coordinates; action outcomes (mousedown / mouseup positions, target elements) are unchanged.

## Skipped automatically

- `speed: 'instant'` (whole humanized drag path is bypassed).
- Both endpoints raw `Point` with curve overflow — there's no scroll position that helps, since shifting both points by the scroll delta just lengthens the drag in the new viewport.
