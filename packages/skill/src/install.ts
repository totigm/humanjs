import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

/**
 * Write the skill file for one target under `cwd`, returning the path written.
 * `codex` merges into an existing `AGENTS.md` (idempotent, never clobbers);
 * the others write self-contained files in their own locations.
 */
export async function installTarget(target: Target, body: string, cwd: string): Promise<string> {
  switch (target) {
    case 'claude': {
      const path = join(cwd, '.claude', 'skills', 'humanjs', 'SKILL.md');
      await writeFileMkdir(path, composeClaude(body));
      return path;
    }
    case 'cursor': {
      const path = join(cwd, '.cursor', 'rules', 'humanjs.mdc');
      await writeFileMkdir(path, composeCursor(body));
      return path;
    }
    case 'codex': {
      const path = join(cwd, 'AGENTS.md');
      const existing = await readIfExists(path);
      await writeFile(path, mergeAgentsMd(existing, body), 'utf8');
      return path;
    }
  }
}
