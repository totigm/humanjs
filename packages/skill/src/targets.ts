/** The tools the installer can write skill files for. */
export type Target = 'claude' | 'cursor' | 'codex';

export const ALL_TARGETS: readonly Target[] = ['claude', 'cursor', 'codex'];

/** Human-readable label per target, for prompts and output. */
export const TARGET_LABELS: Record<Target, string> = {
  claude: 'Claude Code (.claude/skills/humanjs/SKILL.md)',
  cursor: 'Cursor (.cursor/rules/humanjs.mdc)',
  codex: 'Codex (AGENTS.md)',
};

export interface ParsedArgs {
  /** Targets named via flags, or `null` if none were given (→ prompt). */
  readonly targets: Target[] | null;
  /** `-h` / `--help` was passed. */
  readonly help: boolean;
}

/**
 * Parse CLI flags into explicit targets. `--all` selects every target;
 * `--claude` / `--cursor` / `--codex` select individually (combinable).
 * Returns `targets: null` when no target flag is present, so the caller can
 * fall back to an interactive prompt (or the non-TTY guard).
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const help = argv.includes('-h') || argv.includes('--help');
  if (argv.includes('--all')) {
    return { targets: [...ALL_TARGETS], help };
  }
  const picked = ALL_TARGETS.filter((t) => argv.includes(`--${t}`));
  return { targets: picked.length > 0 ? picked : null, help };
}
