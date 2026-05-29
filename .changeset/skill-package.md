---
"@humanjs/skill": minor
---

Initial release of `@humanjs/skill` — a one-command installer that teaches AI coding assistants to write humanized HumanJS automation.

`npx @humanjs/skill` drops the HumanJS skill into your project for **Claude Code** (`.claude/skills/humanjs/SKILL.md`), **Cursor** (`.cursor/rules/humanjs.mdc`), and/or **Codex** (root `AGENTS.md`, merged in place via markers — never clobbered). With no flags it prompts which tools to set up; `--claude` / `--cursor` / `--codex` / `--all` pick non-interactively (and CI / non-TTY use requires flags rather than hanging on a prompt).

Distinct from `@humanjs/mcp`: the MCP server lets an agent *drive* a humanized browser; this skill teaches a coding agent to *write* HumanJS code.
