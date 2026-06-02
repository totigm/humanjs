/**
 * @humanjs/generator — visual recorder for HumanJS.
 *
 * `npx @humanjs/generator <url>` launches a real Chromium window, records the
 * clicks / typing / scrolls / navigation you perform (with role- and
 * accessible-name-first selectors), shows a live, editable timeline in a local
 * dashboard, and exports a clean humanized Playwright test.
 *
 * This is the v0.1 build-out. The CLI shell here parses arguments and reports
 * intent; the browser launch, capture script, local dashboard, and export
 * pipeline land across the following milestones (see ROADMAP.md).
 */

const USAGE = 'Usage: npx @humanjs/generator <url>';

function main(argv: readonly string[]): void {
  const [url] = argv;

  if (!url || url === '--help' || url === '-h') {
    // No URL (or an explicit help flag) — print usage. Exit 0 for --help,
    // exit 1 for a missing-argument error.
    console.log(USAGE);
    process.exit(url ? 0 : 1);
  }

  console.log(`@humanjs/generator: launching ${url} … (not yet implemented)`);
}

main(process.argv.slice(2));
