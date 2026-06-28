import type { Personality } from '../personality';
import type { Rng } from '../rng';

/**
 * Contract for plugins that extend a humanized session.
 *
 * Plugins are plain objects with optional lifecycle hooks. The host
 * (an adapter such as `@humanjs/playwright`) invokes hooks at the
 * appropriate moments — before/after each action and on error.
 *
 * Hooks can be sync or async. Hosts await each hook in registration order.
 * Hooks are observation-only in v1; they cannot transform actions.
 *
 * @example A logger plugin
 * ```ts
 * const logger: HumanPlugin = {
 *   name: 'logger',
 *   beforeAction: (action) => console.log(`[${action.type}] starting`),
 *   afterAction: (action, result) =>
 *     console.log(`[${action.type}] took ${result.durationMs}ms`),
 * };
 * ```
 */
export interface HumanPlugin {
  /** Unique identifier used in logs and observability events. */
  readonly name: string;
  /** Called once when the plugin is installed on a session. */
  install?(context: PluginContext): void | Promise<void>;
  /** Called immediately before every action. */
  beforeAction?(action: HumanAction): void | Promise<void>;
  /** Called immediately after an action completes successfully. */
  afterAction?(action: HumanAction, result: ActionResult): void | Promise<void>;
  /**
   * Called when an action throws. The plugin should not re-throw —
   * the host re-throws after notifying every plugin.
   */
  onError?(action: HumanAction, error: unknown): void | Promise<void>;
}

/**
 * Runtime context provided to a plugin's `install` hook.
 *
 * Contains the resolved personality and the session's seeded RNG so
 * plugins can produce deterministic output (e.g. logging fixtures).
 */
export interface PluginContext {
  /** The resolved personality this session is using. */
  readonly personality: Personality;
  /** The session's seeded RNG. Calling it consumes the shared sequence. */
  readonly rng: Rng;
}

/**
 * Action types HumanJS adapters are known to emit.
 *
 * Plugins can switch on these names for type-safe handling and get IDE
 * autocomplete on them — but `HumanAction.type` is intentionally widened
 * to accept any string so adapters can introduce custom or experimental
 * action types without a core release.
 */
export type KnownActionType =
  | 'check'
  | 'clear'
  | 'click'
  | 'doubleClick'
  | 'drag'
  | 'goBack'
  | 'goForward'
  | 'goto'
  | 'hover'
  | 'move'
  | 'paste'
  | 'read'
  | 'reload'
  | 'rightClick'
  | 'scroll'
  | 'selectOption'
  | 'selectText'
  | 'press'
  | 'sleep'
  | 'type'
  | 'uncheck'
  | 'upload';

/**
 * Loose action-type string: known names autocomplete in IDEs while any
 * other string still typechecks. Implemented with the `(string & {})`
 * idiom — TypeScript surfaces the literal members for completion but
 * widens the type to `string` for assignability.
 */
export type ActionType = KnownActionType | (string & {});

/**
 * A humanized action a plugin can observe.
 *
 * Plugins should treat unknown action types defensively — different
 * adapters emit different sets, and new types can be added at any time.
 */
export interface HumanAction {
  /** Action discriminator. Known values autocomplete; any string is accepted. */
  readonly type: ActionType;
  /** Action-specific parameters. Shape varies by `type`. */
  readonly params?: Readonly<Record<string, unknown>>;
}

/** Outcome of a completed action, passed to `afterAction`. */
export interface ActionResult {
  /** Echo of the originating action's `type`. */
  readonly type: ActionType;
  /** Wall-clock duration in milliseconds. */
  readonly durationMs: number;
}
