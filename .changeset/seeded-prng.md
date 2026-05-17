---
'@humanjs/core': minor
---

Add `createRng` and the `Rng` interface — a seedable PRNG used by every randomized humanization decision (mouse curves, typing delays, dwell times, misclicks). Identical seeds produce identical sequences on every run and every platform, which is what makes humanization snapshot-testable. Algorithm is mulberry32 with FNV-1a string hashing for seeds; Gaussian samples via Box-Muller.
