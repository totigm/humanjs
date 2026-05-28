import type { McpEnv } from './env';
import type { SessionManager } from './session';

/**
 * Everything a tool registrar needs: the session registry plus the
 * resolved environment config. Built once in the bin entry and passed to
 * every `register*Tools` function so tools share one source of truth for
 * sessions and output paths.
 */
export interface ToolContext {
  readonly sessions: SessionManager;
  readonly env: McpEnv;
}
