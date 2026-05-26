---
"@humanjs/core": patch
---

Tightens the `careful` personality's `typoCorrectionProbability` from `0.95` → `0.99`.

The previous value let careful leave an uncorrected typo through ~1 in 60 keystrokes (`0.02 typoProbability × 0.05 no-correction = 0.1% per char`), which over a 16-character form field is ~1.6% — high enough that demo seeds occasionally landed on it and "careful" stopped feeling careful. The new rate is 0.02% per char (~0.3% over 16 chars), so the rare imperfect-human moment still exists but is no longer surfacing in normal use.

`precise` (0.003 × 0.01 = 0.003%/char) remains the right preset for "near-zero typo rate." `distracted` (0.06 × 0.30 = 1.8%/char) is unchanged and remains the right preset for "realistic noisy typing."

If you were relying on careful's previous 5% miss rate to seed test data with occasional typos, override explicitly:

```ts
const human = await createHuman(page, {
  personality: {
    extends: 'careful',
    typing: { typoCorrectionProbability: 0.95 },
  },
});
```
