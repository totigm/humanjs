/**
 * @humanjs/generator — visual recorder for HumanJS.
 *
 * `npx @humanjs/generator <url>` launches a real Chromium window, records the
 * clicks / typing / scrolls / navigation you perform (with role- and
 * accessible-name-first selectors), shows a live, editable timeline in a local
 * dashboard, and exports a clean humanized Playwright test.
 *
 * Milestone 2: the CLI launches the browser and the local dashboard server and
 * wires the WebSocket channel. Capture, the editor UI, and export land across
 * the following milestones (see ROADMAP.md).
 */

import { start } from './run';
import { normalizeUrl } from './url';

const USAGE = 'Usage: npx @humanjs/generator <url>';

async function main(argv: readonly string[]): Promise<void> {
  const [rawUrl] = argv;

  if (!rawUrl || rawUrl === '--help' || rawUrl === '-h') {
    // No URL (or an explicit help flag): print usage. Exit 0 for --help, 1 for
    // a missing-argument error.
    console.log(USAGE);
    process.exit(rawUrl ? 0 : 1);
  }

  await start(normalizeUrl(rawUrl));
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
