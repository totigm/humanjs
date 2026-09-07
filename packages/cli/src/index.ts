/**
 * @humanjs/cli — the `humanjs` command.
 *
 * Two commands, both aimed at the same thing: getting from "I read the
 * README" to "I watched it move" without creating a project.
 *
 *   humanjs demo <url>      drive any page the way a person would skim it
 *   humanjs run <script>    run a HumanJS flow, browser already wired
 *
 * Note on invocation: the unscoped `humanjs` name on npm belongs to an
 * unrelated package from 2022, so `npx humanjs` does NOT reach this CLI.
 * Use `npx @humanjs/cli`, or install it and the `humanjs` binary is
 * yours. The help text below says so, because someone will try.
 */

import { parseArgs, UsageError } from './args';
import { runDemo } from './commands/demo';
import { runReplay } from './commands/replay';
import { runScript } from './commands/run';

// Replaced at build time by tsup's `define`. The fallback is what you
// see when running from source, where no build step has substituted it.
declare const __CLI_VERSION__: string | undefined;
const VERSION = typeof __CLI_VERSION__ === 'string' ? __CLI_VERSION__ : '0.0.0-dev';

const HELP = `humanjs — humanized browser automation

USAGE
  npx @humanjs/cli <command> [options]

  Installed globally, the command is just \`humanjs\`. Note that plain
  \`npx humanjs\` resolves to an unrelated 2022 package, not this one.

COMMANDS
  demo <url>       Drive a page the way a person would skim it: land, read
                   the heading, scroll in stages, drift the cursor over a
                   link. Never clicks — it runs on your site, not ours.
  replay <file>    Re-run a recorded timeline and report whether it still
                   works. Exits 1 on the first failed step, so it drops
                   straight into CI:

                     humanjs demo <url> --record flow.json
                     humanjs replay flow.json

                   The personality, speed and seed the timeline was
                   recorded with are reused unless you override them.
  run <script>     Run a HumanJS flow. The browser and the Human instance
                   are wired for you; the script exports just the flow:

                     export default async (human) => {
                       await human.goto('https://example.com');
                       await human.click('text=Sign in');
                     };

                   .ts files run directly — no build step.

OPTIONS
  --record <file>       Also record the session. The extension picks the
                        format: .mp4 .webm .gif .json (timeline)
                        .ts (HumanJS script) .spec.ts (Playwright test)
  --personality <name>  careful | fast | distracted | precise  (careful)
  --speed <pace>        human | fast | instant                 (human)
  --seed <string>       Make the run deterministic — same seed, same
                        trajectory, every time
  --viewport <WxH>      Browser size                           (1280x800)
  --timeout <ms>        Per-action timeout. Playwright's default is 30000,
                        which makes a failing CI step wait half a minute
                        to tell you something it knew immediately
  --headless            Run without a window (default is headed, because
                        the point of demo is watching it)
  -h, --help            Show this
  -v, --version         Show the version

EXAMPLES
  npx @humanjs/cli demo https://example.com
  npx @humanjs/cli demo https://example.com --record tour.gif
  npx @humanjs/cli run flow.ts --record login.spec.ts --headless
  npx @humanjs/cli replay flow.json --headless

Docs: https://humanjs.dev`;

async function main(): Promise<void> {
  const { command, target, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'help':
      console.log(HELP);
      return;
    case 'version':
      console.log(VERSION);
      return;
    case 'demo':
      if (!target) {
        throw new UsageError('demo needs a URL, e.g. `humanjs demo https://example.com`.');
      }
      await runDemo(target, options);
      return;
    case 'run':
      if (!target) {
        throw new UsageError('run needs a script path, e.g. `humanjs run flow.ts`.');
      }
      await runScript(target, options);
      return;
    case 'replay': {
      if (!target) {
        throw new UsageError('replay needs a timeline file, e.g. `humanjs replay flow.json`.');
      }
      const passed = await runReplay(target, options);
      // Setting exitCode rather than calling process.exit lets stdout
      // flush — a truncated final line in a CI log is worse than useless.
      if (!passed) process.exitCode = 1;
      return;
    }
  }
}

main().catch((error: unknown) => {
  // A usage mistake is not a crash. Printing a stack trace for a typo
  // buries the one line that tells the user what to fix.
  if (error instanceof UsageError) {
    console.error(error.message);
    console.error('\nRun `humanjs help` for usage.');
    process.exit(2);
  }
  console.error(error);
  process.exit(1);
});
