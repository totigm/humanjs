/** The tools the installer can write skill files for. */
export type Target = 'claude' | 'cursor' | 'codex';

export const ALL_TARGETS: readonly Target[] = ['claude', 'cursor', 'codex'];

/** Human-readable label per target, for the interactive prompt. */
export const TARGET_LABELS: Record<Target, string> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  codex: 'Codex',
};

export interface ParsedArgs {
  /** Targets named via flags, or `null` if none were given (→ prompt). */
  readonly targets: Target[] | null;
  /** Install into the user's home locations instead of the current project. */
  readonly global: boolean;
  /** `-h` / `--help` was passed. */
  readonly help: boolean;
}

/**
 * Parse CLI flags. `--all` selects every target; `--claude` / `--cursor` /
 * `--codex` select individually (combinable). `--global` / `-g` installs into
 * the user's home locations. Returns `targets: null` when no target flag is
 * present, so the caller can prompt (or apply the non-TTY guard).
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const help = argv.includes('-h') || argv.includes('--help');
  const global = argv.includes('--global') || argv.includes('-g');
  if (argv.includes('--all')) {
    return { targets: [...ALL_TARGETS], global, help };
  }
  const picked = ALL_TARGETS.filter((t) => argv.includes(`--${t}`));
  return { targets: picked.length > 0 ? picked : null, global, help };
}
