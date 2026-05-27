---
"@humanjs/playwright": minor
"@humanjs/core": patch
---

Wires up the long-declared `personality.mouse.misclickProbability` knob: actions that commit on a mouse press now occasionally produce a visible "near-miss" wobble before landing on the target.

The behavior change is in `@humanjs/playwright`. The `@humanjs/core` patch is a JSDoc update on `MouseProfile.misclickProbability` reflecting the now-wired semantics — no API or runtime changes in core.

When the probability fires for `click`, `rightClick`, or either endpoint of `drag` (grab and drop roll independently):

1. Cursor walks via Bezier path to a near-miss point — 5–15 px outside an edge of the bounding box (element-bound targets) or 5–15 px from the target coordinate in a random direction (raw-`Point` targets, for canvas/SVG drags).
2. Brief "oh, I missed" dwell (scaled by personality — same shape as the pre-click settle beat).
3. Cursor walks the small distance to the real commit point.
4. Click / mousedown / mouseup fires once, on the target.

**The misclick is visible cursor motion only — no `mouse.click`, `mouse.down`, or `mouse.up` event fires at the off-target coordinates.** That's deliberate: dispatching real clicks just outside the target risks hitting ancestor / sibling elements with their own handlers (a destructive button, a modal trigger, a navigation link). Since we can't reliably detect "does this element have an `addEventListener`-attached handler?" from outside the page, the safe-by-construction design is to never fire an event anywhere we didn't mean to.

Drag-over events (`dragover`, `dragenter`, `dragleave`) fire on whatever the cursor passes during a drop-side misclick detour, but those events already fire throughout normal drag motion — the misclick just adds a small extra loop, which reads as exploratory cursor behavior.

## What changes for callers

- `human.click('#target')` and `human.rightClick('#target')` may now show a small cursor detour on the way to the click. The action itself still commits at the resolved coordinates with the same button and same assertions.
- `human.drag('#card', '#slot')` may near-miss the grab, the drop, both, or neither — each endpoint rolls independently. `mousedown` still fires at the resolved `from`; `mouseup` still fires at the resolved `to`.
- Raw-`Point` drag endpoints (`human.drag({ x, y }, ...)`) also misclick — the near-miss is picked 5–15 px from the coordinate in a random direction.
- Action duration is slightly longer when the misclick fires (one extra Bezier walk + a short dwell per fired endpoint).
- `hover`, `move`, `type`, `paste`, `read`, `scroll`, `press` are unchanged.

This is process humanization: how the click / grab / drop happened differs, not what got clicked or where it landed. Personality controls the *rate* of near-misses (precise: 0.001, careful: 0.01, fast: 0.005, distracted: 0.05); the per-action behavior is the same shape across all personalities. Drag's effective miss rate is ~2× the per-roll value because both endpoints roll independently — realistic, since drag is two cognitive moments (grab and drop).

## What stayed the same

- The `misclickProbability` field was already declared on `MouseProfile` and set on all four presets — it just never fired. This release wires it up.
- The preset values are unchanged.
- All other behavior (auto-scroll, hover dwell, action timeline, plugin events) is unchanged. The misclick is a sub-step of the `'click'` action — it doesn't emit its own timeline event.

## Override

If you specifically want to disable the near-miss (e.g. for tightly-timed assertions where the extra detour matters):

```ts
const human = await createHuman(page, {
  personality: {
    extends: 'careful',
    mouse: { misclickProbability: 0 },
  },
});
```

Or set it higher than the preset for stronger humanization signal in demos. The field is part of the public `MouseProfile` type.

## Edge cases

- **Cursor already on the target.** When the action starts with the cursor already inside the target's bounding box (or within a few pixels of a raw-Point target), the near-miss beat is suppressed. A real user doesn't aim away from a button they're already hovering — the misclick is fundamentally an approach pattern, so no approach means no overshoot. The probability roll still happens (so RNG state stays seed-deterministic), but the beat itself is skipped. This catches the case where the user scrolled into the element, where the previous action left the cursor on the target, or any other "already there" scenario.
- **Targets at the viewport edge:** if the candidate misclick point would land off-screen, the misclick is skipped for that action (rather than producing a "near-miss" that gets clamped back onto the target).
- **Determinism:** same seed produces the same misclick decisions and same misclick coordinates. Misclick fires/skips deterministically per seed, like every other humanization knob.

## Note for snapshot-style tests

Wiring `misclickProbability` into the mouse path consumes one RNG value per misclick decision — once per `click` / `rightClick` action, and twice per `drag` (one per endpoint). Existing seeded sessions will produce **different intermediate cursor coordinates** after upgrade — even when no misclick fires — because downstream RNG state is shifted by those consumers.

Action outcomes (click coordinates, mousedown / mouseup positions, the resolved button, the target element) are unchanged. Only tests snapshotting the exact mouse-move sequence against a seed will need to refresh their snapshots. Tests asserting page state, form values, or action results (the typical kind) are unaffected.
