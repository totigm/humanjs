---
"@humanjs/playwright": patch
---

Keep recording when a single screenshot fails, instead of losing the whole take.

The capture loop treated any `page.screenshot()` rejection as terminal: it stopped, captured nothing more, and the export then failed with "No frames were captured". A transient `Page.captureScreenshot` protocol error is ordinary on a page under load — a heavy animation or a font swap is enough to cause one — so recording a real site could fail outright with no useful explanation.

Transient failures now drop a single frame and the loop continues, matching how a failed frame *write* was already handled a few lines away. A closed page still stops immediately, and ten consecutive failures still give up rather than spinning at the frame rate forever. The dropped-frame warning is emitted once per run of failures, not once per frame.
