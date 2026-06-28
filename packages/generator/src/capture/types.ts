/**
 * The action payload the in-page recorder posts to the CLI over the
 * `__humanjsEmit` binding. Deliberately DOM-free so both the Node capture
 * wiring and the browser-side recorder can share the type.
 *
 * The CLI stamps `tMs` / `durationMs` on receipt to turn this into a
 * `@humanjs/playwright` `TimelineEvent`.
 */
export interface CapturedAction {
  /** A HumanJS primitive name: `click`, `type`, `press`, `scroll`, … */
  readonly type: string;
  /** Primitive params — `{ target }`, `{ key }`, `{ values }`, etc. Includes ranked selector `candidates` for element-targeted actions. */
  readonly params: Record<string, unknown>;
  /** Captured field value for `type`; omitted for password fields (masked). */
  readonly inputValue?: string;
}
