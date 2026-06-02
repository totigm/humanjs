/**
 * Message contract for the dashboard WebSocket channel.
 *
 * `ServerMessage` flows CLI → dashboard; `ClientMessage` flows dashboard → CLI.
 * Both unions grow as later milestones add live timeline streaming, edits, and
 * export commands — for now the channel just carries the initial handshake.
 */

/** CLI → dashboard. */
export type ServerMessage = {
  /** Sent to each client on connect — tells the dashboard which site is being recorded. */
  readonly type: 'hello';
  readonly targetUrl: string;
};

/** dashboard → CLI. */
export type ClientMessage = {
  /** Liveness ping; the CLI ignores the payload. */
  readonly type: 'ping';
};
