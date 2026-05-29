---
"@humanjs/skill": minor
---

Add a `--global` / `-g` flag to install the skill for every project instead of the current one. Claude Code goes to `~/.claude/skills/humanjs/SKILL.md` and Codex to `~/.codex/AGENTS.md` (merged in place, never clobbered). Cursor has no global rules file, so it's skipped with guidance to install per-project or paste into Cursor's user-rules settings. Combine with target flags (e.g. `npx @humanjs/skill -g --claude`) or run `npx @humanjs/skill --global` to pick interactively.
