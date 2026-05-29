/**
 * Pure composition: given the shared skill body (markdown), produce the file
 * content for each target tool. No filesystem access — see `install.ts` for
 * the I/O side. Keeping this pure makes the frontmatter and the (fiddly)
 * AGENTS.md merge unit-testable.
 */

/** A short, single-line summary used in the Claude/Cursor frontmatter. */
export const SKILL_DESCRIPTION =
  'Write humanized Playwright automation with HumanJS — use when creating or editing browser automation, QA tests, or demo scripts that should move, type, scroll, and read like a real user (createHuman, personalities, recorder, code export).';

/** Markers delimiting the HumanJS block inside a shared `AGENTS.md`. */
export const AGENTS_START = '<!-- humanjs:start -->';
export const AGENTS_END = '<!-- humanjs:end -->';

/** Claude Code skill: YAML frontmatter (`name`, `description`) + body. */
export function composeClaude(body: string): string {
  return `---\nname: humanjs\ndescription: ${SKILL_DESCRIPTION}\n---\n\n${body.trimEnd()}\n`;
}

/** Cursor project rule (`.mdc`): frontmatter + body. Not auto-applied; the
 * agent attaches it by relevance via the description. */
export function composeCursor(body: string): string {
  return `---\ndescription: ${SKILL_DESCRIPTION}\nglobs: []\nalwaysApply: false\n---\n\n${body.trimEnd()}\n`;
}

/** The body wrapped in the marker block, for embedding in `AGENTS.md`. */
export function composeAgentsBlock(body: string): string {
  return `${AGENTS_START}\n\n${body.trimEnd()}\n\n${AGENTS_END}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Merge the HumanJS block into an existing `AGENTS.md` without clobbering the
 * user's content. Idempotent:
 * - no existing file (null/empty) → the block becomes the file
 * - markers already present → replace the block in place
 * - file exists without markers → append the block
 *
 * Running it twice with the same body yields identical output.
 */
export function mergeAgentsMd(existing: string | null, body: string): string {
  const block = composeAgentsBlock(body);
  if (existing === null || existing.trim() === '') {
    return `${block}\n`;
  }
  const markerRe = new RegExp(`${escapeRegExp(AGENTS_START)}[\\s\\S]*?${escapeRegExp(AGENTS_END)}`);
  if (markerRe.test(existing)) {
    return existing.replace(markerRe, block);
  }
  return `${existing.trimEnd()}\n\n${block}\n`;
}
