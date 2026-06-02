/**
 * Message contract for the dashboard WebSocket channel.
 *
 * `ServerMessage` flows CLI → dashboard; `ClientMessage` flows dashboard → CLI.
 * Both unions grow as later milestones add timeline edits.
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
    }
  | {
      /** Generated code for the current timeline — refreshed on every change. */
      readonly type: 'code';
      readonly code: string;
    }
  | {
      /** Confirmation that an export was written to disk. */
      readonly type: 'exported';
      readonly path: string;
    };

/** dashboard → CLI. */
export type ClientMessage = {
  /** Write the current timeline to disk in the requested format. */
  readonly type: 'export';
  readonly format: 'spec' | 'script';
};
