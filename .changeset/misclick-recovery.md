---
"@humanjs/playwright": minor
---

Wires up the long-declared `personality.mouse.misclickProbability` knob: actions that commit on a mouse press now occasionally produce a visible "near-miss" wobble before landing on the target.

When the probability fires for `click`, `rightClick`, or the `from` endpoint of `drag`:

1. Cursor walks via Bezier path to a near-miss point — 5–15 px outside an edge of the bounding box (element-bound targets) or 5–15 px from the target coordinate in a random direction (raw-`Point` targets, for canvas/SVG drags).
2. Brief "oh, I missed" dwell (scaled by personality — same shape as the pre-click settle beat).
3. Cursor walks the small distance to the real click point.
4. Click / mousedown fires once, on the target.

**The misclick is visible cursor motion only — no `mouse.click` or `mouse.down` event fires at the off-target coordinates.** That's deliberate: dispatching real clicks just outside the target risks hitting ancestor / sibling elements with their own handlers (a destructive button, a modal trigger, a navigation link). Since we can't reliably detect "does this element have an `addEventListener`-attached handler?" from outside the page, the safe-by-construction design is to never fire an event anywhere we didn't mean to.

## What changes for callers

- `human.click('#target')`, `human.rightClick('#target')`, and `human.drag('#card', '#slot')` may now show a small cursor detour on the way to the click / grab. The action itself still commits at the resolved coordinates with the same button and same assertions.
- `human.drag({ x, y }, ...)` (raw-Point `from`) also misclicks — the near-miss point is picked 5–15 px from the coordinate in a random direction.
- Action duration is slightly longer when the misclick fires (one extra Bezier walk + a short dwell).
- `hover`, `move`, `type`, `paste`, `read`, `scroll`, `press` are unchanged. Drag's `to` endpoint is also unchanged: mouseup is the single commit moment, with no "almost dropped" pattern to model.

This is process humanization: how the click / grab happened differs, not what got clicked. Personality controls the *rate* of near-misses (precise: 0.001, careful: 0.01, fast: 0.005, distracted: 0.05); the per-action behavior is the same shape across all personalities.

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

- Targets at the viewport edge: if the candidate misclick point would land off-screen, the misclick is skipped for that action (rather than producing a "near-miss" that gets clamped back onto the target).
- Determinism: same seed produces the same misclick decisions and same misclick coordinates. Misclick fires/skips deterministically per seed, like every other humanization knob.
