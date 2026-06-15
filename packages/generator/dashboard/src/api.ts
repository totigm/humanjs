import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage, Step } from '../../src/protocol';

export interface GeneratorState {
  readonly targetUrl: string;
  readonly steps: readonly Step[];
  readonly personality: string;
  readonly personalities: readonly string[];
  readonly code: string;
}

export interface Generator {
  readonly state: GeneratorState | null;
  readonly connected: boolean;
  readonly exportedPath: string | null;
  send(message: ClientMessage): void;
}

/** Connect to the CLI's dashboard channel and track the latest state snapshot. */
export function useGenerator(): Generator {
  const [state, setState] = useState<GeneratorState | null>(null);
  const [connected, setConnected] = useState(false);
  const [exportedPath, setExportedPath] = useState<string | null>(null);
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
      }
    };
    return () => socket.close();
  }, []);

  const send = (message: ClientMessage): void => {
    socketRef.current?.send(JSON.stringify(message));
  };

  return { state, connected, exportedPath, send };
}
