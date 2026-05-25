---
"@humanjs/core": minor
"@humanjs/playwright": patch
---

Personality-driven click placement: `MouseProfile` now includes `clickSpread`, controlling how far click points scatter from the target's center.

Previously, every personality used a hardcoded `1/8` spread inside `pickClickPoint`. `careful` and `distracted` clicked buttons identically — broke the personality contract harder than the typing rhythm or scroll cadence differences mattered. Now each preset has its own value:

| Personality | `clickSpread` | What it looks like |
|---|---|---|
| `precise` | `0.10` | Tightest cluster near center — expert-user aim. |
| `careful` | `0.125` | Slight scatter — same as the previous global default, no behavior change for default users. |
| `fast` | `0.15` | Noticeable scatter — Fitts's Law: speed trades against precision. |
| `distracted` | `0.17` | Loosest of the four — eye-drift clicks. |

The math: σ = `box.dimension × clickSpread`, separately for X and Y. The result is clamped to the box, so values above ~0.5 start hitting edges constantly (and the presets stay well below that).

`blend()` interpolates `clickSpread` linearly, same as every other personality knob.

**Migration**: custom personalities built with `extends` continue to inherit the preset's value automatically. Personalities built from scratch (no `extends`) need to set `mouse.clickSpread` explicitly — the field is required. A safe default is `0.125` (the previous global behavior).
