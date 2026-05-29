import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { cancel, intro, isCancel, multiselect, outro } from '@clack/prompts';
import { installTarget } from './install';
import { ALL_TARGETS, parseArgs, TARGET_LABELS, type Target } from './targets';

const HELP = `humanjs-skill — install the HumanJS coding-agent skill

Teaches Claude Code, Cursor, and Codex to write humanized Playwright
automation with HumanJS. Run it in your project root.

Usage:
  npx @humanjs/skill [targets]

Targets (omit to choose interactively):
  --claude     .claude/skills/humanjs/SKILL.md
  --cursor     .cursor/rules/humanjs.mdc
  --codex      AGENTS.md (merged in place — never clobbered)
  --all        all of the above
  -h, --help   show this help
`;

/** The shared skill body, shipped alongside the bundle in `templates/`. */
function readBody(): string {
  return readFileSync(new URL('../templates/skill-body.md', import.meta.url), 'utf8');
}

/** Interactive multiselect of targets. Returns `null` if the user cancels. */
async function promptTargets(): Promise<Target[] | null> {
  intro('HumanJS skill installer');
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
  const { targets: flagged, help } = parseArgs(argv);

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
    targets = await promptTargets();
    if (targets === null) return;
  }

  const body = readBody();
  const cwd = process.cwd();
  const written: string[] = [];
  for (const target of targets) {
    written.push(await installTarget(target, body, cwd));
  }

  const list = written.map((p) => `  ${relative(cwd, p) || p}`).join('\n');
  outro(`Installed the HumanJS skill:\n${list}`);
}

main().catch((error) => {
  console.error('[humanjs-skill] failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
