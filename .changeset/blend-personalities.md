---
'@humanjs/core': minor
---

Add `blend(a, b, ratio)` — composes two personalities into a new one by linearly interpolating every numeric field. Accepts preset names, full personalities, or extensions on either side, and blends are themselves composable.

```ts
const mostlyCareful = blend('careful', 'distracted', 0.3); // 70% careful, 30% distracted
```

Ratios outside `[0, 1]` clamp. The result is a fresh `Personality` with the source names and ratio encoded in `result.name` for log clarity.
