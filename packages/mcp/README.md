# @humanjs/mcp

Model Context Protocol server for [HumanJS](https://humanjs.dev) — let AI agents drive a Playwright browser with **humanized** motion, typing, and reading dwell.

It's Playwright-MCP-but-humanized: the same stdio protocol every desktop AI client speaks, except every action moves like a person and the cursor is visible — so live demos and recordings look real, not robotic.

> **Audience:** AI agent builders, QA engineers, and demo/tutorial creators. HumanJS is **not** a scraping, captcha-bypass, or "undetectable automation" tool — see the [non-goals](https://humanjs.dev).

## Quick start

Add it to your MCP client config. The server runs over stdio via `npx`, so there's nothing to install globally.

**Claude Desktop** (`claude_desktop_config.json`), **Claude Code** (`~/.claude.json` or project `.mcp.json`), **Cursor** (`.cursor/mcp.json`), **Codex**, **Cline**, etc. all use the same shape:

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

Restart the client, then ask it to do something in a browser:

> "Use HumanJS to open example.com, search for 'docs', and screenshot the result."

The first browser action launches a visible Chromium window with the humanized cursor overlay.

## Environment variables

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `HUMANJS_PERSONALITY` | `careful` \| `fast` \| `distracted` \| `precise` | `careful` | Default personality for every session. |
| `HUMANJS_HEADLESS` | `true` \| `false` | `false` | Headless browser. Default is visible — the point of the MCP. |
| `HUMANJS_OUTPUT_DIR` | path | server's CWD | Where screenshots and recordings are written. |

## Tools

**Primitives** — the humanized actions:

| Tool | What it does |
|---|---|
| `human_goto` | Navigate to a URL |
| `human_click` | Click (selector **or** x/y coordinates) |
| `human_rightClick` | Context-menu click (selector or coordinates) |
| `human_hover` | Hover an element (tooltips, dropdowns) |
| `human_move` | Move the cursor (selector or coordinates) |
| `human_drag` | Drag between two points (each a selector or coordinates) |
| `human_type` | Type with realistic per-key rhythm |
| `human_paste` | Insert text in one shot (Cmd-V semantic) |
| `human_press` | Press a key or chord (`Enter`, `Mod+S`, …) |
| `human_scroll` | Scroll the page or a container |
| `human_read` | Dwell as if reading (visible cursor scan) |

Click / rightClick / move / drag take a **selector or raw x/y coordinates** — coordinates are the fallback for controls with no clean selector (icon-only buttons, canvas, SVG) that the agent can see in a screenshot.

**Inspection** — read page state so the agent isn't flying blind:

| Tool | What it does |
|---|---|
| `human_screenshot` | Capture the page/element; returns the image to view, optionally saves it |
| `human_page_text` | Visible text of the whole page |
| `human_get_text` | Visible text of one element |
| `human_get_attribute` | An element's attribute (`aria-label`, `href`, …) |
| `human_get_html` | An element's `outerHTML` — discover the real selector of a control |

**Recording** — capture the session:

| Tool | What it does |
|---|---|
| `human_start_recording` | Begin capturing (frames + action timeline) |
| `human_stop_recording` | Finalize and write `.mp4` / `.webm` / `.gif` / `.json` |

**Sessions** — only needed for parallel browsers; the default session is implicit:

| Tool | What it does |
|---|---|
| `human_create_session` | Open a new isolated session |
| `human_close_session` | Close a session |
| `human_list_sessions` | List open sessions |

**Config:**

| Tool | What it does |
|---|---|
| `human_set_personality` | Switch preset or blend two presets at runtime |

## Personalities

Four presets, each a different blend of speed, mouse curvature, typo rate, and reading pace:

- `careful` — deliberate, low error rate (default)
- `fast` — quick, minimal dwell
- `distracted` — overshoots, occasional typos and scroll corrections
- `precise` — straight paths, tight aim

Set the default with `HUMANJS_PERSONALITY`, override per session at creation, or change mid-session with `human_set_personality` ("now fill this form like a distracted user").

## Security

- **No arbitrary-JS `evaluate` tool.** Executing page-supplied JavaScript is a prompt-injection cliff — a malicious page could trick the agent into running code that exfiltrates data. The read-only inspection tools cover the legitimate "what's on the page" need.
- **File-path safety.** Tools that write files accept a basename only; path components (`../`, absolute paths) are rejected, so a prompt-injected filename can't escape `HUMANJS_OUTPUT_DIR`.
- **No credentials handling.** The server drives the browser; it doesn't manage logins, payment details, or secrets on your behalf.

## Honest limits

- Built on Playwright — humanizes it, doesn't replace it. Will not defeat sophisticated bot detection (fingerprinting, TLS, request patterns), and isn't meant to.
- One Chromium process backs the server; each session is an isolated context. Heavy parallel use is bounded by memory.
- Recording requires `ffmpeg` for video/gif output (bundled via the recorder); `.json` timelines have no such dependency.

## License

MIT
