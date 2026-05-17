---
'@humanjs/core': minor
---

Add the `Personality` type and the four built-in presets: `careful`, `fast`, `distracted`, and `precise`.

`Personality` is the stable, publicly exported data shape every humanization run reads from. Community packages can publish `@anything/personality-*` against this shape — the type is exported from `@humanjs/core` and treated as a v1 contract.
