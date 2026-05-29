import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { cancel, intro, isCancel, multiselect, outro } from '@clack/prompts';
import { installTarget } from './install';
import { ALL_TARGETS, parseArgs, TARGET_LABELS, type Target } from './targets';

const HELP = `humanjs-skill — install the HumanJS coding-agent skill

Teaches Claude Code, Cursor, and Codex to write humanized Playwright
automation with HumanJS. Run it in your project root, or with --global.

Usage:
  npx @humanjs/skill [targets] [--global]

Targets (omit to choose interactively):
  --claude     project: .claude/skills/humanjs/SKILL.md  · global: ~/.claude/skills/humanjs/SKILL.md
  --cursor     project: .cursor/rules/humanjs.mdc        · (no global rules file — see below)
  --codex      project: ./AGENTS.md                      · global: ~/.codex/AGENTS.md   (merged, never clobbered)
  --all        all of the above
  --global, -g install for every project (your home dir) instead of this one
  -h, --help   show this help
`;

/** The shared skill body, shipped alongside the bundle in `templates/`. */
function readBody(): string {
  return readFileSync(new URL('../templates/skill-body.md', import.meta.url), 'utf8');
}

/** Interactive multiselect of targets. Returns `null` if the user cancels. */
async function promptTargets(global: boolean): Promise<Target[] | null> {
  intro(global ? 'HumanJS skill installer (global)' : 'HumanJS skill installer');
  const selected = await multiselect<Target>({
    message: 'Which tools should get the HumanJS skill?',
    options: ALL_TARGETS.map((value) => ({ value, label: TARGET_LABELS[value] })),
    required: true,
  });
  if (isCancel(selected)) {
    cancel('Cancelled — nothing was written.');
    return null;
  }
  return selected;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { targets: flagged, global, help } = parseArgs(argv);

  if (help) {
    process.stdout.write(HELP);
    return;
  }

  let targets = flagged;
  if (targets === null) {
    if (!process.stdin.isTTY) {
      // Non-interactive (piped / CI) with no flags: don't hang on a prompt.
      process.stderr.write(HELP);
      process.stderr.write(
        '\nNo targets given and not running interactively. Pass --claude / --cursor / --codex / --all.\n',
      );
      process.exitCode = 1;
      return;
    }
    targets = await promptTargets(global);
    if (targets === null) return;
  }

  const body = readBody();
  const cwd = process.cwd();
  const written: string[] = [];
  const skipped: Target[] = [];
  for (const target of targets) {
    const path = await installTarget(target, body, cwd, { global });
    if (path === null) skipped.push(target);
    else written.push(path);
  }

  // Global paths live outside the project, so show them absolute.
  const fmt = (p: string) => (global ? p : relative(cwd, p) || p);
  const lines: string[] = [];
  if (written.length > 0) {
    lines.push(global ? 'Installed the HumanJS skill globally:' : 'Installed the HumanJS skill:');
    for (const p of written) lines.push(`  ${fmt(p)}`);
  }
  if (skipped.includes('cursor')) {
    if (lines.length > 0) lines.push('');
    lines.push('Cursor has no global rules file — add it per-project with');
    lines.push('`npx @humanjs/skill --cursor`, or paste the skill into');
    lines.push('Cursor → Settings → Rules (User Rules).');
  }
  outro(lines.join('\n'));
}

main().catch((error) => {
  console.error('[humanjs-skill] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
