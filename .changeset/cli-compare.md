---
"@humanjs/cli": minor
---

Add `humanjs compare <url>` — the side-by-side, generated for your own site.

Records the same tour twice, once as straight Playwright and once humanized, and stacks them horizontally into one video:

```bash
npx @humanjs/cli compare https://your-app.com --record before-after.mp4
```

The robotic lane is not a caricature of bad automation — it is `speed: 'instant'`, the documented mode that bypasses humanization entirely. Both lanes run the identical tour, so the only variable on screen is the motion, and no timing math is reimplemented to fake the comparison.

The lanes rarely last the same time, which is the message rather than a problem: the shorter one is extended by holding its final frame, so the robotic side sits frozen while the other is still working. The summary names the ratio.

Lane labels are painted with CSS through `body::before` rather than burned in with ffmpeg's `drawtext`, which needs a font file present on the host and fails differently on every machine.
