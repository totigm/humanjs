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

## Tools (22)

- **Primitives** — `human_goto`, `human_click`, `human_rightClick`, `human_hover`, `human_move`, `human_drag`, `human_type`, `human_paste`, `human_press`, `human_scroll`, `human_read`. Click / rightClick / move / drag accept a selector **or** raw x/y coordinates (the fallback for icon-only buttons, canvas, SVG you can see in a screenshot).
- **Inspection** — `human_screenshot` (returns the image to view, optionally saves it), `human_page_text`, `human_get_text`, `human_get_attribute`, `human_get_html`. Enough to act + observe with one server; no Playwright MCP needed alongside.
- **Recording** — `human_start_recording` / `human_stop_recording`. Capture the session to mp4 / webm / gif / JSON timeline; the visible cursor is in the video.
- **Sessions** — `human_create_session`, `human_close_session`, `human_list_sessions`. The default session is implicit; these are only for parallel browsers.
- **Config** — `human_set_personality`. Switch preset or blend two presets at runtime.

## Environment

- `HUMANJS_PERSONALITY` — default personality (`careful` | `fast` | `distracted` | `precise`). Default `careful`.
- `HUMANJS_HEADLESS` — `true` for headless. Default `false` (visible browser — the point of the MCP).
- `HUMANJS_OUTPUT_DIR` — where screenshots / recordings are written. Default: the server's working directory.

## Security

No arbitrary-JS `evaluate` tool — that's a prompt-injection cliff (a malicious page could trick an agent into running JS that exfiltrates data). The read-only inspection tools cover the legitimate need. File-producing tools accept a basename only; path components are rejected so a prompt-injected filename can't escape `HUMANJS_OUTPUT_DIR`.
