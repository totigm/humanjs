---
"@humanjs/playwright": minor
"@humanjs/generator": minor
---

Add `recordReplay(page, timeline, options?)` — replay a recorded `Timeline` against a live page **while capturing frames**, and get back a `Recording` you export with `.toVideo()` / `.toGif()`. It's the timeline twin of `human.record()` (which captures a live callback): same humanized motion, cursor overlay on by default (the video's whole point is to show the cursor move), no `@playwright/test` needed. It returns the `Recording` even if the replay fails partway — the video just stops there. Composes `replayTimeline` + the recorder's frame poller + ffmpeg assembly; no new dependencies.

`@humanjs/generator` uses it for **Export .mp4 / .gif** buttons in the dashboard: they replay the curated recording in a fresh, capture-free window and write a clean `.mp4` / `.gif` of exactly the flow — no fumbles or thinking pauses — to the working directory. Great for the demo / tutorial-creator audience and side-by-side hero clips. Shares the Run busy-guard (one replay/export at a time) and surfaces failures in the dashboard.
