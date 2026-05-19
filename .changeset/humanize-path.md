---
'@humanjs/core': minor
'@humanjs/playwright': patch
---

Add `humanizePath()` post-processor for realistic mouse trajectories.

Takes a raw Bezier path and applies two transformations:

- **Velocity profile** — resamples the path with a smoothstep-warped arc length, producing the bell-shaped velocity curve observed in human motor studies (small steps at the endpoints, large steps in the middle).
- **Micro-jitter** — adds Gaussian sub-pixel noise to interior points, simulating natural hand tremor. Endpoints stay exact so click targets land cleanly.

Both transforms are deterministic given a seeded `Rng`. The individual transforms (`applyVelocityProfile`, `applyMicroJitter`) are also exported for composition or advanced use.

Coming next: the `click()` action that consumes Bezier path + `humanizePath` to produce visible humanized motion.
