---
"@humanjs/core": minor
---

All built-in personality presets now set `typoCorrectionProbability: 1.0` — the library guarantees the value you pass to `human.type(target, value)` lands in the field as-is.

| Preset | Before | After |
|---|---|---|
| `precise` | `0.99` | `1.0` |
| `careful` | `0.95` | `1.0` |
| `fast` | `0.90` | `1.0` |
| `distracted` | `0.70` | `1.0` |

## Why

The old defaults left an uncorrected typo through randomly:

- `careful` × 16-char field: ~1.6% chance of a silent typo
- `distracted` × 16-char field: ~26% chance
- Longer flows (multi-field forms) compound the rate

That's the worst kind of test failure: rare enough to look like a flake, frequent enough to break trust. Output is still deterministic per-seed, but the field value depends on which seed you happen to pick — and any rotation of seeds (per-test seeding, CI matrix builds) shifts which characters survive. The contract `human.type(target, value)` is the kind of thing tests and AI agents rely on being **seed-invariant** at the output level: same input → same field value, regardless of seed. Personality controls *how* the value is typed (rate of mid-typing stumbles, key delays, think pauses) — not *what* lands.

The visible humanization signal (wrong key → backspace → right key) is fully preserved. Every typo still fires that beat; what changes is that the typo always gets corrected on the way to the final character.

## What still works

- Personality differences are entirely in the typing process. `distracted` still produces visibly more stumbles than `careful`; `precise` still types cleaner.
- Existing personality overrides still typecheck and work — `typoCorrectionProbability` remains a public field on `TypingProfile`.
- If you specifically need uncorrected typos in the output (stress-testing form validation, modeling truly inattentive users), override explicitly with eyes open:

  ```ts
  const human = await createHuman(page, {
    personality: {
      extends: 'distracted',
      typing: { typoCorrectionProbability: 0.7 },
    },
  });
  ```

  The field's JSDoc flags this as advanced — output stays deterministic given a fixed seed, but the final field-value becomes seed-dependent (change the seed and surviving typos shift), which is rarely what tests want.

## Migration

If you were relying on the old miss rates to seed test data with realistic typos, use the override above. For "test how my form handles bad input," pass the imperfect value directly — that's clearer than rolling dice:

```ts
await human.type('#email', 'demi@humanjs.dev');  // intentional typo
```
