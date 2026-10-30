/**
 * Multi-match reads — the machinery behind `all: true` on the inspection
 * tools.
 *
 * Sweeping a page is the compact alternative to dumping its HTML: every
 * image source, every row label, every link target in one call. The
 * subtlety is that the elements are read one by one *after* they matched,
 * and a live page can replace one in between — so the interesting part of
 * this module is what it does when a single reading fails.
 */

import type { Locator } from 'playwright';

/**
 * Default sweep caps, set by how expensive one match is to return: a
 * hundred labels is a reasonable page sweep, a hundred outerHTML dumps is
 * not.
 */
export const TEXT_SWEEP_LIMIT = 100;
export const HTML_SWEEP_LIMIT = 10;

/**
 * How long one element in a sweep gets before it is written off.
 *
 * Deliberately far below Playwright's 30-second default: a sweep reads
 * elements that *already matched*, so a slow read means the element is
 * gone, not that it is still arriving. Waiting the full default would
 * stall the whole call on one stale match.
 */
export const SWEEP_READ_TIMEOUT_MS = 2000;

/** One element's reading: either a value, or why it could not be read. */
export type SweepRead<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

/**
 * Reads one value per matched element, keeping the readings that succeed.
 *
 * `locator.all()` returns locators bound to `nth=i` that are re-resolved
 * on every read, so an element the page replaced between the match and
 * the read fails. Under `Promise.all` that single failure would reject
 * the whole call and discard every value that *did* read — after a
 * 30-second stall. Each read gets a short deadline of its own instead,
 * and the ones that fail are reported in place.
 */
export async function sweepRead<T>(
  elements: readonly Locator[],
  read: (element: Locator) => Promise<T>,
): Promise<readonly SweepRead<T>[]> {
  const settled = await Promise.allSettled(elements.map((element) => read(element)));
  return settled.map((result) =>
    result.status === 'fulfilled' ? { ok: true, value: result.value } : { ok: false },
  );
}

/** Renders a sweep, marking the elements that could not be read. */
export function sweepBody<T>(
  readings: readonly SweepRead<T>[],
  render: (value: T) => string,
  separator = '\n',
): string {
  return readings
    .map((reading, index) =>
      reading.ok
        ? `[${index}] ${render(reading.value)}`
        : `[${index}] (unreadable — the page replaced this element mid-sweep)`,
    )
    .join(separator);
}

/**
 * Footer telling the agent when it is looking at a truncated sweep, or at
 * one with holes in it.
 *
 * The unreadable count is not decoration: "this page has no alt text" and
 * "the list re-rendered while I was reading it" call for different next
 * moves, and only the footer can tell them apart.
 */
export function sweepSummary(
  readings: readonly SweepRead<unknown>[],
  total: number,
  selector: string,
): string {
  const shown = readings.length;
  const unreadable = readings.filter((reading) => !reading.ok).length;
  const head =
    shown >= total
      ? `— ${total} element${total === 1 ? '' : 's'} matched ${selector}`
      : `— showing the first ${shown} of ${total} elements matching ${selector}; raise \`limit\` to see more`;
  if (unreadable === 0) return head;
  return `${head}; ${unreadable} could not be read — re-run if you need ${unreadable === 1 ? 'it' : 'them'}`;
}
