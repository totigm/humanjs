---
'@humanjs/playwright': minor
---

Wire up `Personality.dwell.preClickMs` and `Personality.dwell.postActionMs` in `human.click()`.

After the mouse settles on the target — before the click — a humanized session now pauses for `preClickMs` (with `preClickJitter` randomization). After the click resolves, it pauses again for `postActionMs`. Both dwells are scaled by `Personality.speed` and the global speed mode; `speed: 'instant'` skips both.

This closes the gap the API doc comment hinted at:

```ts
await human.click(selector);  // hover, micro-move, click
                              //       ↑ now actually happens
```

Different personalities feel measurably different now: `careful` settles for ~120ms before clicking, `distracted` for ~200ms, `precise` for ~80ms. None of those involved code changes — they were already in the preset definitions, just unused until this PR.
