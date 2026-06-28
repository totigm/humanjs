import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, ReplayStatus, ServerMessage, Step } from '../../src/protocol';

export interface GeneratorState {
  readonly targetUrl: string;
  readonly steps: readonly Step[];
  readonly personality: string;
  readonly personalities: readonly string[];
  readonly code: string;
}

export interface ReplayStepState {
  readonly status: ReplayStatus;
  readonly error?: string;
}

export interface ReplayResultState {
  readonly status: 'pass' | 'fail';
  readonly aborted?: boolean;
  readonly failedStepId?: string;
  readonly error?: string;
  readonly durationMs: number;
}

/** Live replay state: whether a run is in flight, per-step badges, last result. */
export interface ReplayState {
  readonly running: boolean;
  readonly steps: Readonly<Record<string, ReplayStepState>>;
  readonly result: ReplayResultState | null;
}

const IDLE_REPLAY: ReplayState = { running: false, steps: {}, result: null };

export interface Generator {
  readonly state: GeneratorState | null;
  readonly connected: boolean;
  readonly exportedPath: string | null;
  readonly replay: ReplayState;
  send(message: ClientMessage): void;
}

/** Connect to the CLI's dashboard channel and track the latest state snapshot. */
export function useGenerator(): Generator {
  const [state, setState] = useState<GeneratorState | null>(null);
  const [connected, setConnected] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [replay, setReplay] = useState<ReplayState>(IDLE_REPLAY);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const scheme = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const socket = new WebSocket(scheme + location.host);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'state') {
        setState({
          targetUrl: message.targetUrl,
          steps: message.steps,
          personality: message.personality,
          personalities: message.personalities,
          code: message.code,
        });
      } else if (message.type === 'exported') {
        setExportedPath(message.path);
      } else if (message.type === 'replayStarted') {
        setReplay({ running: true, steps: {}, result: null });
      } else if (message.type === 'replayStep') {
        const { id, status, error } = message;
        setReplay((prev) => ({
          ...prev,
          steps: { ...prev.steps, [id]: { status, ...(error ? { error } : {}) } },
        }));
      } else if (message.type === 'replayDone') {
        const { status, aborted, failedStepId, error, durationMs } = message;
        setReplay((prev) => ({
          ...prev,
          running: false,
          result: {
            status,
            durationMs,
            ...(aborted ? { aborted } : {}),
            ...(failedStepId ? { failedStepId } : {}),
            ...(error ? { error } : {}),
          },
        }));
      }
    };
    return () => socket.close();
  }, []);

  const send = (message: ClientMessage): void => {
    socketRef.current?.send(JSON.stringify(message));
  };

  return { state, connected, exportedPath, replay, send };
}
