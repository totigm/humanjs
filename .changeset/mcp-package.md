---
"@humanjs/mcp": minor
---

Initial release of `@humanjs/mcp` — a Model Context Protocol server that lets AI agents (Claude Desktop, Claude Code, Cursor, Codex, Cline, …) drive a Playwright browser with humanized motion, typing, and reading dwell.

It's "Playwright MCP, but humanized": same stdio protocol every desktop AI client speaks, except every action moves like a person and the cursor is visible (so recordings and live demos look real).

Configure it in your MCP client:

```jsonc
{
  "mcpServers": {
    "humanjs": {
      "command": "npx",
      "args": ["-y", "@humanjs/mcp"],
      "env": { "HUMANJS_PERSONALITY": "careful" }
    }
  }
}
```

Requires Node ≥ 20. The `playwright` npm package is bundled, and the Chromium browser binary downloads automatically on first launch if it's missing (~150MB, one time) — so `npx -y @humanjs/mcp` works with zero manual setup. Set `HUMANJS_AUTO_INSTALL=false` to opt out and install manually with `npx playwright install chromium`.

The server also ships **built-in agent guidance** (MCP `instructions`): explore selectors first then record one clean run, settle debounced/dynamic UI before targeting elements, and wait for navigation before stopping a recording — so natural-looking recordings don't need the user to spell out the workflow.

## Tools (29)

- **Primitives** — `human_goto`, `human_click`, `human_rightClick`, `human_hover`, `human_move`, `human_drag`, `human_type`, `human_paste`, `human_press`, `human_scroll`, `human_read`. Click / rightClick / move / drag accept a selector **or** raw x/y coordinates (the fallback for icon-only buttons, canvas, SVG you can see in a screenshot).
- **Inspection** — `human_screenshot` (returns the image to view, optionally saves it), `human_page_text`, `human_get_text`, `human_get_attribute`, `human_get_html`. Enough to act + observe with one server; no Playwright MCP needed alongside.
- **Waiting** — `human_wait` (fixed pause for debounce/animation), `human_wait_for_load` (navigation/network settle).
- **Recording** — `human_start_recording` / `human_stop_recording`. Capture the session and export to one or more of mp4 / webm / gif / JSON timeline in a single stop (e.g. video + timeline from one recording); the visible cursor is in the video.
- **Sessions** — `human_create_session` (optional personality + speed + viewport), `human_close_session`, `human_list_sessions`. The default session is implicit; these are only for parallel browsers.
- **Config** — `human_set_personality` (switch preset or blend at runtime), `human_set_speed` (humanization pace), `human_set_viewport` (resize the live viewport).
- **Browser** — `human_browser_info` (report mode/channel/persistence), `human_enable_persistence` (persistent profile, optional restart-now), `human_restart_browser` (apply a change or recover).

## Environment

- `HUMANJS_PERSONALITY` — default personality (`careful` | `fast` | `distracted` | `precise`). Default `careful`.
- `HUMANJS_SPEED` — humanization pace (`human` | `fast` | `instant`). Default `human`.
- `HUMANJS_HEADLESS` — `true` for headless. Default `false` (visible browser — the point of the MCP).
- `HUMANJS_OUTPUT_DIR` — where screenshots / recordings are written. Default: the server's working directory.
- `HUMANJS_VIEWPORT` — default viewport `WIDTHxHEIGHT` for new sessions. Default `1440x900`.
- `HUMANJS_PERSIST` — persist a profile across runs (logins survive). Default `false`.
- `HUMANJS_USER_DATA_DIR` — explicit persistent profile directory.
- `HUMANJS_CDP_URL` — attach to an already-running browser over CDP (your real logins/tabs).
- `HUMANJS_CHANNEL` — launch an installed browser (`chrome`, `msedge`, …) instead of bundled Chromium.

## Browser modes

Default is a fresh, isolated browser each run. Opt into a persistent profile (`HUMANJS_PERSIST` / `HUMANJS_USER_DATA_DIR`) to keep logins across runs, or attach to your already-running browser (`HUMANJS_CDP_URL`) to use its real sessions. `HUMANJS_CHANNEL=chrome` alone only swaps the binary — it does **not** reuse your profile. Persistent/CDP modes drive a single shared browser (no parallel sessions). Persistence is also togglable from chat (`human_enable_persistence` + `human_restart_browser`); attaching to your real browser stays env-only by design.

## Security

No arbitrary-JS `evaluate` tool — that's a prompt-injection cliff (a malicious page could trick an agent into running JS that exfiltrates data). The read-only inspection tools cover the legitimate need. File-producing tools accept a basename only; path components are rejected so a prompt-injected filename can't escape `HUMANJS_OUTPUT_DIR`.
