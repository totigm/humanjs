# @humanjs/core

## 0.1.0

### Minor Changes

- d48f654: Add `blend(a, b, ratio)` — composes two personalities into a new one by linearly interpolating every numeric field. Accepts preset names, full personalities, or extensions on either side, and blends are themselves composable.

  ```ts
  const mostlyCareful = blend("careful", "distracted", 0.3); // 70% careful, 30% distracted
  ```

  Ratios outside `[0, 1]` clamp. The result is a fresh `Personality` with the source names and ratio encoded in `result.name` for log clarity.

- 2561c53: Add the `Personality` type and the four built-in presets: `careful`, `fast`, `distracted`, and `precise`.

  `Personality` is the stable, publicly exported data shape every humanization run reads from. Community packages can publish `@anything/personality-*` against this shape — the type is exported from `@humanjs/core` and treated as a v1 contract.

- 2d76237: Add the plugin contract: `HumanPlugin`, `PluginContext`, `HumanAction`, `ActionResult`, plus `KnownActionType` and `ActionType`.

  Plugins are plain objects with four optional lifecycle hooks — `install`, `beforeAction`, `afterAction`, `onError`.

  `ActionType` is a soft union: `KnownActionType` literals (`'click'`, `'type'`, `'scroll'`, …) autocomplete in IDEs, but any string still typechecks. This gives plugin authors discoverability while letting adapters emit custom or experimental action types without a core release.

  Observation-only in v1: hooks cannot transform actions. Action-transform hooks may arrive later as a non-breaking addition once concrete use cases exist.

- bb74f65: Add `resolvePersonality()` and its supporting types `PersonalityConfig`, `PersonalityExtension`, and `PresetName`.

  `resolvePersonality()` turns the layered config — a preset name like `'careful'`, a preset with partial overrides like `{ extends: 'careful', typing: { typoProbability: 0.1 } }`, or a fully built `Personality` — into a flat `Personality`. Never mutates the base preset.

  This is the entry point every consumer hits, enabling the public layered API from `createHuman({ personality: ... })`.

- c4dd128: Add `createRng` and the `Rng` interface — a seedable PRNG used by every randomized humanization decision (mouse curves, typing delays, dwell times, misclicks). Identical seeds produce identical sequences on every run and every platform, which is what makes humanization snapshot-testable. Algorithm is mulberry32 with FNV-1a string hashing for seeds; Gaussian samples via Box-Muller.
