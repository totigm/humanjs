/**
 * Message contract for the dashboard WebSocket channel.
 *
 * `ServerMessage` flows CLI → dashboard; `ClientMessage` flows dashboard → CLI.
 * Both unions grow as later milestones add timeline edits and export commands.
 */

import type { TimelineEvent } from '@humanjs/playwright';

/** CLI → dashboard. */
export type ServerMessage =
  | {
      /** Sent to each client on connect — which site is being recorded. */
      readonly type: 'hello';
      readonly targetUrl: string;
    }
  | {
      /** A newly captured interaction, appended to the live timeline. */
      readonly type: 'event';
      readonly event: TimelineEvent;
    };

/** dashboard → CLI. */
export type ClientMessage = {
  /** Liveness ping; the CLI ignores the payload. */
  readonly type: 'ping';
};
