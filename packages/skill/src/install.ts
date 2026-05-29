import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { composeClaude, composeCursor, mergeAgentsMd } from './compose';
import type { Target } from './targets';

async function writeFileMkdir(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/** Read a file, returning `null` if it doesn't exist (rethrows other errors). */
async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export interface InstallOptions {
  /** Install into the user's home locations rather than `cwd`. */
  readonly global?: boolean;
}

/**
 * Write the skill file for one target, returning the path written — or `null`
 * when the target has no installable location for the chosen scope (Cursor has
 * no global rules file). `codex` merges into an existing `AGENTS.md`
 * (idempotent, never clobbers); the others write self-contained files.
 *
 * Global locations: Claude → `~/.claude/skills/`, Codex → `~/.codex/AGENTS.md`.
 */
export async function installTarget(
  target: Target,
  body: string,
  cwd: string,
  opts: InstallOptions = {},
): Promise<string | null> {
  switch (target) {
    case 'claude': {
      const base = opts.global ? homedir() : cwd;
      const path = join(base, '.claude', 'skills', 'humanjs', 'SKILL.md');
      await writeFileMkdir(path, composeClaude(body));
      return path;
    }
    case 'cursor': {
      // Cursor's global rules ("User Rules") live in app settings, not a file.
      if (opts.global) return null;
      const path = join(cwd, '.cursor', 'rules', 'humanjs.mdc');
      await writeFileMkdir(path, composeCursor(body));
      return path;
    }
    case 'codex': {
      const path = opts.global ? join(homedir(), '.codex', 'AGENTS.md') : join(cwd, 'AGENTS.md');
      const existing = await readIfExists(path);
      await writeFileMkdir(path, mergeAgentsMd(existing, body));
      return path;
    }
  }
}
