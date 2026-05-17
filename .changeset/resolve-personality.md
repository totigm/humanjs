---
'@humanjs/core': minor
---

Add `resolvePersonality()` and its supporting types `PersonalityConfig`, `PersonalityExtension`, and `PresetName`.

`resolvePersonality()` turns the layered config — a preset name like `'careful'`, a preset with partial overrides like `{ extends: 'careful', typing: { typoProbability: 0.1 } }`, or a fully built `Personality` — into a flat `Personality`. Never mutates the base preset.

This is the entry point every consumer hits, enabling the public layered API from `createHuman({ personality: ... })`.
