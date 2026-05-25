---
"@humanjs/recorder": minor
---

Initial release of `@humanjs/recorder` — one-call session recording for HumanJS.

```ts
import { record } from '@humanjs/recorder';

await record({ output: 'demo.mp4', url: 'https://example.com' }, async (human) => {
  await human.click('a');
  await human.type('#search', 'humanjs');
});
// → demo.mp4 written
```

A single function call wraps the entire lifecycle: browser launch, context creation, page setup, human session, the recorded callback, frame capture + encoding via the bundled `ffmpeg-static`, and cleanup. The marketing / demo / tutorial use case in one line.

Two overloads: `record(fn)` for no-options recording (timeline-only by default), and `record(options, fn)` when you want a video output or other configuration.

Quality presets pick both source viewport and ffmpeg encoding settings:

- `'fast'` — 720p, JPEG q=85, CRF 23, preset fast (iteration)
- `'standard'` — 1080p, JPEG q=90, CRF 20, preset fast (balanced)
- `'high'` (default) — 1080p, JPEG q=95, CRF 18, preset slow, tune animation (marketing-grade)
- `'lossless'` — 1080p, PNG capture, CRF 12, preset veryslow (archival)

The visible cursor overlay is auto-installed by default so the recorded video shows mouse motion; opt out with `cursor: false`.

**Public surface:**

- `record(fn)` / `record(options, fn)` — the one-call helper
- `RecordOptions`, `RecordCallback` — typed option/callback shapes
- `Recording` (re-exported from `@humanjs/playwright`) — so users can type local variables without a second import

For users who need to compose with existing Playwright code, `human.record()` from `@humanjs/playwright` is the lower-level API this package wraps.
