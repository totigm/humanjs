---
'@humanjs/core': minor
---

Add the plugin contract: `HumanPlugin`, `PluginContext`, `HumanAction`, `ActionResult`, plus `KnownActionType` and `ActionType`.

Plugins are plain objects with four optional lifecycle hooks — `install`, `beforeAction`, `afterAction`, `onError`.

`ActionType` is a soft union: `KnownActionType` literals (`'click'`, `'type'`, `'scroll'`, …) autocomplete in IDEs, but any string still typechecks. This gives plugin authors discoverability while letting adapters emit custom or experimental action types without a core release.

Observation-only in v1: hooks cannot transform actions. Action-transform hooks may arrive later as a non-breaking addition once concrete use cases exist.
