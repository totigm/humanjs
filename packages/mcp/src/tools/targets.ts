/**
 * Shared schema + resolver for tools whose target can be either a selector
 * or raw coordinates. Keeping this in one place means click, rightClick,
 * move, and each drag endpoint all describe coordinates to the AI the same
 * way, and the "exactly one of selector / (x,y)" validation lives once.
 */

import type { MouseTarget } from '@humanjs/playwright';
import { z } from 'zod';

/** Flat schema fields for a single selector-or-point target. */
export const targetFields = {
  selector: z
    .string()
    .optional()
    .describe(
      'Playwright-compatible selector. Provide this OR x/y — not both. Prefer role/text selectors over brittle CSS.',
    ),
  x: z
    .number()
    .optional()
    .describe(
      'X coordinate (CSS px from viewport left). Use x+y when there is no clean selector — e.g. an icon-only button you can see in a screenshot. Requires y.',
    ),
  y: z.number().optional().describe('Y coordinate (CSS px from viewport top). Requires x.'),
};

/**
 * Resolves the flat selector / x / y fields into a `MouseTarget`. Throws a
 * clear error if neither or both are supplied — an AI agent recovers
 * better from "provide exactly one" than from a silent wrong default.
 */
export function resolveTarget(input: { selector?: string; x?: number; y?: number }): MouseTarget {
  const hasSelector = input.selector !== undefined;
  const hasPoint = input.x !== undefined && input.y !== undefined;
  if (hasSelector && hasPoint) {
    throw new Error('Provide either a selector or x/y coordinates, not both.');
  }
  if (hasSelector) return input.selector as string;
  if (hasPoint) return { x: input.x as number, y: input.y as number };
  if (input.x !== undefined || input.y !== undefined) {
    throw new Error('Coordinate targets need both x and y.');
  }
  throw new Error('Provide a selector or x/y coordinates.');
}
