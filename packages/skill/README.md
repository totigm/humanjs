# @humanjs/skill

<p>
  <a href="https://www.npmjs.com/package/@humanjs/skill"><img alt="npm" src="https://img.shields.io/npm/v/@humanjs/skill"></a>
  <a href="https://www.npmjs.com/package/@humanjs/skill"><img alt="downloads" src="https://img.shields.io/npm/dt/@humanjs/skill"></a>
  <a href="https://github.com/totigm/humanjs"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-totigm%2Fhumanjs-181717?logo=github"></a>
  <a href="https://github.com/totigm/humanjs/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/totigm/humanjs/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/totigm/humanjs/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@humanjs/skill"></a>
  <a href="https://humanjs.dev"><img alt="docs" src="https://img.shields.io/badge/docs-humanjs.dev-emerald"></a>
</p>

Teach your AI **coding** assistant to write correct [HumanJS](https://humanjs.dev) — humanized Playwright automation. One command drops the skill into your project for Claude Code, Cursor, and/or Codex.

> Different from [`@humanjs/mcp`](../mcp): the **MCP server** lets an agent *drive* a humanized browser at runtime; this **skill** teaches a coding agent to *write* HumanJS code.

## Usage

Run it in your project root:

```bash
npx @humanjs/skill
```

With no flags it asks which tools to set up. Or name them directly:

```bash
npx @humanjs/skill --all                  # all three
npx @humanjs/skill --claude --cursor       # pick some
```

| Flag | Writes |
|---|---|
| `--claude` | `.claude/skills/humanjs/SKILL.md` |
| `--cursor` | `.cursor/rules/humanjs.mdc` |
| `--codex` | `AGENTS.md` (merged in place — see below) |
| `--all` | all of the above |
| `-h`, `--help` | usage |

The same instructions go to every target; only the wrapper format and location differ. Re-running is safe — files are overwritten with the latest skill, and `AGENTS.md` is updated in place.

### AGENTS.md is never clobbered

For Codex, the skill is written into your root `AGENTS.md` between markers:

```md
<!-- humanjs:start -->
… HumanJS skill …
<!-- humanjs:end -->
```

If `AGENTS.md` doesn't exist it's created; if it exists, the block is appended (your content untouched); if the markers are already there, the block is replaced in place. Idempotent.

### Non-interactive use

In CI or any non-TTY context the prompt is skipped — pass explicit flags (`--all`, etc.). Running with no flags and no TTY prints usage and exits non-zero instead of hanging.

## Copy-paste instead

Don't want the installer? Grab [`templates/skill-body.md`](./templates/skill-body.md) from this package and drop it where your tool looks:

- **Claude Code** → `.claude/skills/humanjs/SKILL.md` (add `name` + `description` frontmatter)
- **Cursor** → `.cursor/rules/humanjs.mdc` (add `description`, `globs`, `alwaysApply` frontmatter)
- **Codex / any tool** → paste into your root `AGENTS.md`

## License

MIT
