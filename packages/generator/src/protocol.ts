/**
 * Message contract for the dashboard WebSocket channel.
 *
 * `ServerMessage` flows CLI → dashboard; `ClientMessage` (editor commands)
 * flows dashboard → CLI. The CLI owns the canonical timeline: it applies every
 * command, regenerates the code, and broadcasts a fresh `state` snapshot.
 */

import type { TimelineEvent } from '@humanjs/playwright';

/** A timeline event with a stable id so the editor can reference it. */
export interface Step extends TimelineEvent {
  readonly id: string;
}

export type AssertKind = 'visible' | 'text' | 'url';

/** Fields an `update` command can change on a step. */
export interface StepPatch {
  /** Chosen selector (from the ranked candidates). */
  readonly target?: string;
  /** Edited captured value (type / paste). */
  readonly inputValue?: string;
  /** Free-text annotation, emitted as a comment above the step. */
  readonly label?: string;
  /** Env var name to export the value as `process.env.*`; `null` clears it. */
  readonly secret?: string | null;
}

/** Per-step replay status, shown as a badge in the editor. */
export type ReplayStatus = 'running' | 'pass' | 'fail';

/** CLI → dashboard. */
export type ServerMessage =
  | {
      readonly type: 'state';
      readonly targetUrl: string;
      readonly steps: readonly Step[];
      readonly personality: string;
      readonly personalities: readonly string[];
      readonly code: string;
    }
  | {
      readonly type: 'exported';
      readonly path: string;
    }
  | { readonly type: 'replayStarted' }
  | {
      readonly type: 'replayStep';
      readonly id: string;
      readonly status: ReplayStatus;
      readonly error?: string;
    }
  | {
      readonly type: 'replayDone';
      readonly status: 'pass' | 'fail';
      /** True when the run was cancelled rather than failing on a step. */
      readonly aborted?: boolean;
      /** Step that failed, when `status` is `'fail'` and a specific step caused it. */
      readonly failedStepId?: string;
      /** Run-level error (page crashed / context failed), distinct from a step failure. */
      readonly error?: string;
      readonly durationMs: number;
    }
  | {
      readonly type: 'exportFailed';
      readonly format: ExportFormat;
      readonly error: string;
    };

/** What the export command (and a failure) can target. */
export type ExportFormat = 'spec' | 'script' | 'mp4' | 'gif';

/** dashboard → CLI. */
export type ClientMessage =
  | { readonly type: 'delete'; readonly id: string }
  | { readonly type: 'move'; readonly id: string; readonly toIndex: number }
  | { readonly type: 'reorder'; readonly ids: readonly string[] }
  | { readonly type: 'update'; readonly id: string; readonly patch: StepPatch }
  | {
      readonly type: 'addAssert';
      readonly afterId: string | null;
      readonly kind: AssertKind;
      readonly target?: string;
      readonly value?: string;
    }
  | { readonly type: 'setPersonality'; readonly personality: string }
  | { readonly type: 'export'; readonly format: ExportFormat }
  | { readonly type: 'replay' }
  | { readonly type: 'cancelReplay' };
