---
"@humanjs/mcp": minor
---

Add observability and media-emulation tools, and let the read tools sweep every match.

`human_console_messages` and `human_network_requests` expose what the page reports about itself — console output, uncaught errors, response statuses, and requests that failed before responding. Neither a screenshot nor page text shows a CORS rejection or a 404 on an asset, so until now the only recourse was guessing, or checking with `curl` from outside the browser where the failure does not reproduce. Capture starts with the session, buffers hold the last 500 entries, and the number dropped is always reported so a quiet result is never mistaken for a clean page.

`human_emulate_media` emulates `prefers-reduced-motion`, `prefers-color-scheme` and `forced-colors`. The reduced-motion path is otherwise untestable without changing OS settings, so it tends to ship unverified.

`human_get_text`, `human_get_attribute` and `human_get_html` accept `all: true` to read every element a selector matches instead of only the first, with `limit` bounding the response. Extracting every image source on a page is now one call. A sweep keeps the readings that succeed: an element the page replaces mid-sweep is marked in place and counted in the footer, rather than failing the whole call and discarding every value that did read.

These three tools now also read the **first** match when `all` is not set, which is what they always documented. Previously an ambiguous selector raised Playwright's strict-mode error instead — so a selector matching several elements returns a value now where it used to fail. If you were relying on that error to tell you a selector was too broad, `all: true` reports the match count explicitly.

`human_screenshot` now returns a line of text alongside the image. An image-only result was rendered as "Tool ran without output or errors" by clients that summarize from text content, which read as a failure even though the capture had succeeded.
