# @humanjs/mcp

<p>
  <a href="https://www.npmjs.com/package/@humanjs/mcp"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/mcp"></a>
  <a href="https://www.npmjs.com/package/@humanjs/mcp"><img alt="downloads" src="https://img.shields.io/npm/dt/@humanjs/mcp"></a>
  <a href="https://github.com/totigm/humanjs"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-totigm%2Fhumanjs-181717?logo=github"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/totigm/humanjs/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/mcp"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
</p>

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

> **Requirements:** Node ≥ 20. The `playwright` npm package is bundled as a dependency, and the **Chromium browser binary downloads automatically** on first launch if it's missing (~150MB, one time). To disable that auto-download in locked-down environments, set `HUMANJS_AUTO_INSTALL=false` and install manually with `npx playwright install chromium`.

### One-command install

Some clients can register the server for you, no manual JSON:

**Claude Code:**

```bash
# this project only (default scope: local)
claude mcp add humanjs --env HUMANJS_PERSONALITY=careful -- npx -y @humanjs/mcp

# all your projects (global): add --scope user (-s user)
claude mcp add humanjs --scope user --env HUMANJS_PERSONALITY=careful -- npx -y @humanjs/mcp
```

`--scope` is `local` (default, this project only), `user` (you, across all projects), or `project` (shared via a checked-in `.mcp.json`). Use `user` for a one-time global install.

**Cursor** — one click:

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=humanjs&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBodW1hbmpzL21jcCJdfQ==)

The `config` payload is base64 of `{"command":"npx","args":["-y","@humanjs/mcp"]}` — regenerate it via [cursor.com/docs/mcp/install-links](https://cursor.com/docs/mcp/install-links) if you change the command or add env vars.

## Environment variables

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `HUMANJS_PERSONALITY` | `careful` \| `fast` \| `distracted` \| `precise` | `careful` | Default personality for every session. |
| `HUMANJS_SPEED` | `human` \| `fast` \| `instant` | `human` | Humanization pace. `human` = full realistic motion; `fast` = humanized but quick; `instant` = no humanized motion. Changes how long each action *executes*, not the wait between actions. |
| `HUMANJS_HEADLESS` | `true` \| `false` | `false` | Headless browser. Default is visible — the point of the MCP. |
| `HUMANJS_OUTPUT_DIR` | path | server's CWD | Where screenshots and recordings are written. |
| `HUMANJS_UPLOAD_DIR` | path | server's CWD | Folder `human_upload` reads files from (basename only — can't escape it). |
| `HUMANJS_VIEWPORT` | `WIDTHxHEIGHT` | `1440x900` | Default viewport for new sessions. Bump to `1920x1080` for crisper recordings. |
| `HUMANJS_AUTO_INSTALL` | `true` \| `false` | `true` | Auto-download the Chromium binary on first launch if missing. Set `false` to require a manual `npx playwright install chromium`. |
| `HUMANJS_PERSIST` | `true` \| `false` | `false` | Persist a profile across runs (logins/cookies survive). Uses `~/.humanjs/profile` unless `HUMANJS_USER_DATA_DIR` is set. See [Browser modes](#browser-modes). |
| `HUMANJS_USER_DATA_DIR` | path | — | Explicit persistent profile directory (implies persistence). |
| `HUMANJS_CDP_URL` | URL | — | Attach to an already-running browser over CDP (e.g. `http://localhost:9222`) and use its real logins/tabs. |
| `HUMANJS_CHANNEL` | `chrome` \| `msedge` \| … | bundled Chromium | Launch an installed browser's binary instead of bundled Chromium. Does **not** by itself reuse your profile/logins. |

All of these go in the `env` block of the client config from [Quick start](#quick-start) — for example, a bigger default viewport and headless mode:

```jsonc
{
  "mcpServers": {
    "humanjs": {
      "command": "npx",
      "args": ["-y", "@humanjs/mcp"],
      "env": {
        "HUMANJS_PERSONALITY": "careful",
        "HUMANJS_VIEWPORT": "1920x1080",
        "HUMANJS_HEADLESS": "false"
      }
    }
  }
}
```

Changes to `env` take effect on the next client restart. To resize without restarting, use the `human_set_viewport` tool mid-session.

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
| `human_outline` | Accessibility-tree outline — every interactive element by role + name |
| `human_get_text` | Visible text of one element, or of every match with `all` |
| `human_get_attribute` | An element's attribute (`aria-label`, `href`, …), or every match's with `all` |
| `human_get_html` | An element's `outerHTML` — discover the real selector of a control |

`human_get_text`, `human_get_attribute` and `human_get_html` read the first match by default. Pass `all: true` to sweep every match instead — every image `src`, every row label, every link `href` — with `limit` capping how many come back. Prefer `human_get_attribute` with `all` over `human_get_html` when you only need one attribute per element: same answer, a fraction of the tokens.

**Observability** — what the page said about itself:

| Tool | What it does |
|---|---|
| `human_console_messages` | Console output and uncaught page errors, filterable by regex or `onlyErrors` |
| `human_network_requests` | Responses with method/URL/status/timing; `onlyFailures` covers 4xx/5xx *and* requests that never completed |

Both start capturing when the session opens, so you can act first and ask afterwards — there is no "start capturing" call to forget. These are the only way to see a CORS rejection, a 404 on an asset, or a thrown `TypeError`: none of them appear in a screenshot or in page text. Buffers hold the last 500 entries and report how many were dropped, so a quiet result is never mistaken for a clean page. Pass `clear: true` to reset before an action and see only what that action caused.

**Recording** — capture the session:

| Tool | What it does |
|---|---|
| `human_start_recording` | Begin capturing (frames + action timeline) |
| `human_stop_recording` | Finalize and write one or more files — `.mp4` / `.webm` (video), `.gif`, `.json` (timeline), `.ts` (HumanJS script), `.spec.ts` / `.test.ts` (Playwright test). Pass several to export multiple ways, e.g. a video + a ready-to-commit test |

**Sessions** — only needed for parallel browsers; the default session is implicit:

| Tool | What it does |
|---|---|
| `human_create_session` | Open a new isolated session (optional `personality`, `speed`, `width`/`height`) |
| `human_close_session` | Close a session |
| `human_list_sessions` | List open sessions |

**Config:**

| Tool | What it does |
|---|---|
| `human_set_personality` | Switch preset or blend two presets at runtime |
| `human_set_speed` | Switch humanization pace at runtime (`human` / `fast` / `instant`) |
| `human_set_viewport` | Resize the viewport at runtime (bigger/crisper recording, responsive testing) |
| `human_emulate_media` | Emulate `prefers-reduced-motion`, `prefers-color-scheme` and `forced-colors` |

`human_emulate_media` is what makes accessibility paths testable. `reducedMotion: 'reduce'` is normally impossible to check without changing OS settings, so a site's reduced-motion path tends to ship unverified; here it is one call. Same for dark mode and Windows High Contrast. Settings persist across navigations until changed — pass `'system'` to stop emulating.

**Browser:**

| Tool | What it does |
|---|---|
| `human_browser_info` | Report the browser mode (ephemeral / persistent / CDP), channel, and whether logins persist |
| `human_enable_persistence` | Switch to a persistent profile so logins survive across runs (optionally restart now) |
| `human_restart_browser` | Restart the browser to apply a change, or recover a wedged one |

## Personalities

Four presets, each a different blend of speed, mouse curvature, typo rate, and reading pace:

- `careful` — deliberate, low error rate (default)
- `fast` — quick, minimal dwell
- `distracted` — overshoots, occasional typos and scroll corrections
- `precise` — straight paths, tight aim

Set the default with `HUMANJS_PERSONALITY`, override per session at creation, or change mid-session with `human_set_personality` ("now fill this form like a distracted user").

## Speed

How fast each action *executes* — orthogonal to personality:

- `human` (default) — full realistic pace. Best for polished demo recordings.
- `fast` — same humanized motion (Bezier paths, dwell, typing rhythm) at a brisk pace. A good fit when an agent is getting work done and you still want it to look human.
- `instant` — bypasses humanization entirely (straight Playwright, no visible motion). Maximum throughput when realism doesn't matter.

Set the default with `HUMANJS_SPEED`, override per session at creation (`human_create_session`), or change mid-session with `human_set_speed`.

> **Speed does not change the wait *between* actions.** That gap is the MCP client running one model inference per tool call — inherent to agentic tool use and outside this server's control. Speed only affects how long an action takes to run once it starts. To reduce between-action waiting, make fewer tool calls.

## Browser modes

By default each run gets a **fresh, empty browser** — predictable and isolated, but with no saved logins. Three ways to change that:

| You want… | Set | What you get |
|---|---|---|
| Stay logged in across runs | `HUMANJS_PERSIST=true` (or `HUMANJS_USER_DATA_DIR=/path`) | A dedicated HumanJS profile. Sign in once *in it*; it persists. Starts empty. |
| Drive a browser you launched | `HUMANJS_CDP_URL=http://localhost:9222` | Attach to a Chrome you started with `--remote-debugging-port` (see below). Reuses that instance's tabs and whatever you've signed into *there*. |
| A specific browser binary | `HUMANJS_CHANNEL=chrome` | Launches installed Chrome instead of bundled Chromium. **On its own, still a fresh profile** — combine with persistence or CDP for real logins. |

Common trap: `HUMANJS_CHANNEL=chrome` alone does **not** give you your existing Chrome cookies/logins — it only swaps the binary. To keep logins, use a persistent profile or CDP attach.

### Attaching over CDP

`HUMANJS_CDP_URL` connects to a browser **you launch yourself** with a remote-debugging port and a **separate profile dir**:

```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/.humanjs-chrome"

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.humanjs-chrome"

# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:USERPROFILE\.humanjs-chrome"
```

Then set `HUMANJS_CDP_URL=http://localhost:9222`. Log into whatever you need in that window once; it lives in the `--user-data-dir` you chose (use a stable path like `~/.humanjs-chrome`, **not** `/tmp`, so it survives reboots).

> **You can't attach to your everyday Chrome.** Chrome only exposes a debug port when launched with the flag, and since ~v136 it **refuses `--remote-debugging-port` on your default profile** (a security fix that stopped malware reading your cookies via CDP). So a separate `--user-data-dir` is required — it's a distinct profile, not your normal one. If all you want is "stay logged in," `HUMANJS_PERSIST=true` is simpler and skips this dance entirely.

You can also toggle persistence from chat: `human_enable_persistence` (then `human_restart_browser` to apply now), and `human_browser_info` reports the current mode. Switching to a CDP browser stays env-only by design — it's a consent decision the agent shouldn't escalate into.

Persistent and CDP modes drive a **single shared browser**, so named/parallel sessions (`human_create_session`) aren't available in those modes — which is exactly what you want when the point is one logged-in browser.

> Library users (`@humanjs/playwright` directly) get all of this by creating the page themselves — see that package's "Using your own browser or a persistent profile" section.

## Recordings & dynamic UI

The server ships **built-in guidance** (sent to the agent on connect via MCP `instructions`), so you don't have to spell out the workflow each time. The agent is told to:

- **Explore first, then record one clean run — as a single batch.** Discover correct selectors in an un-recorded pass, then dispatch the whole run (`human_start_recording` → every action → `human_stop_recording`) in one turn. This is what makes recordings smooth: emitting the tool calls together means they fire back-to-back, whereas a step-by-step loop puts a multi-second model-inference pause between each action — dead air in the video. The motion is already humanized, so don't reach for `fast`/`instant` to "fix" the feel.
- **Use specific selectors on dynamic lists.** After a debounced search/filter the list reflows; the agent uses role/aria-label selectors (not text) so it targets the right element rather than a stale one.

**Exploration is on by default for recordings.** When you ask for a recording, the agent first runs an un-recorded pass to discover the right selectors, then records the clean batched run — you don't have to ask for it. A bare "record me buying a ticket on X" should produce a clean take without the play-by-play. To skip exploration (e.g. it's a simple flow, or you've already given the exact selectors), just tell the agent not to explore.

## Security

- **No arbitrary-JS `evaluate` tool.** Executing page-supplied JavaScript is a prompt-injection cliff — a malicious page could trick the agent into running code that exfiltrates data. The read-only inspection and observability tools cover the legitimate need instead: `human_get_attribute`/`human_get_text` with `all` sweep every match, `human_outline` maps what is actionable, and `human_console_messages`/`human_network_requests` expose what the page reported. Their internal `locator.evaluate` calls run fixed, hard-coded functions — never a string supplied by the model or the page.
- **File-path safety.** Tools that write files accept a basename only; path components (`../`, absolute paths) are rejected, so a prompt-injected filename can't escape `HUMANJS_OUTPUT_DIR`.
- **Upload path safety.** `human_upload` can attach a local file to a web form — a potential exfiltration path if a page prompt-injects the agent. So it reads files by **basename only** from `HUMANJS_UPLOAD_DIR` (default: the server's working dir); subdirectories, `../`, and absolute paths are rejected, so the agent can't reach (and send) files outside that folder. Point `HUMANJS_UPLOAD_DIR` at where your upload fixtures live.
- **No credentials handling.** The server drives the browser; it doesn't manage logins, payment details, or secrets on your behalf.
- **Attaching to your real browser (CDP) is opt-in and env-only.** When you point `HUMANJS_CDP_URL` at your running browser, the agent acts with *your* live sessions — a bigger blast radius if a page tries to manipulate it. That's why it's a deliberate config choice you make up front, never something a tool can switch on.

## Honest limits

- Built on Playwright — humanizes it, doesn't replace it. Will not defeat sophisticated bot detection (fingerprinting, TLS, request patterns), and isn't meant to.
- One Chromium process backs the server; each session is an isolated context. Heavy parallel use is bounded by memory.
- Recording requires `ffmpeg` for video/gif output (bundled via the recorder); `.json` timelines have no such dependency.

## License

MIT
