/**
 * Awaitable sleep — pause for `ms` milliseconds. The single utility
 * HumanJS ships beyond personality math because it shows up in every
 * demo and most user code that spaces out humanized actions for visual
 * pacing. Trivial implementation; exported so users don't have to write
 * the same one-liner in every file.
 *
 * @example
 * ```ts
 * await sleep(800);
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
