---
"@humanjs/playwright": minor
---

Wires up the long-declared `personality.mouse.misclickProbability` knob: clicks now occasionally produce a visible "near-miss" wobble before landing on the target.

When the probability fires for a `click` / `rightClick` action:

1. Cursor walks via Bezier path to a point 5–15 px outside an edge of the target's bounding box.
2. Brief "oh, I missed" dwell (scaled by personality — same shape as the pre-click settle beat).
3. Cursor walks the small distance to the real click point inside the box.
4. Click fires once, on the target.

**The misclick is visible cursor motion only — no `mouse.click` event fires at the off-target coordinates.** That's deliberate: dispatching real clicks just outside the target risks hitting ancestor / sibling elements with their own handlers (a destructive button, a modal trigger, a navigation link). Since we can't reliably detect "does this element have an `addEventListener`-attached handler?" from outside the page, the safe-by-construction design is to never fire a click anywhere we didn't mean to.

## What changes for callers

- `human.click('#target')` and `human.rightClick('#target')` may now show a small cursor detour before clicking. The click itself still lands on `#target` with the same button and same assertions.
- Action duration is slightly longer when the misclick fires (one extra Bezier walk + a short dwell).
- `hover` / `move` / `drag` / `type` / `paste` are unchanged — only the click-shaped actions misclick.

This is process humanization: how the click happened differs, not what got clicked. Personality controls the *rate* of near-misses (precise: 0.001, careful: 0.01, fast: 0.005, distracted: 0.05); the per-click behavior is the same shape across all personalities.

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
