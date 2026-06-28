import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { PLACEHOLDER_HTML } from './dashboard-placeholder';
import type { ServerMessage } from './protocol';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
// The built Vite dashboard lands in dist/dashboard/ (milestone 5). Until it
// exists, the root path falls back to the embedded placeholder.
const DASHBOARD_DIR = join(MODULE_DIR, 'dashboard');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function contentTypeFor(filePath: string): string {
  const dot = filePath.lastIndexOf('.');
  const ext = dot === -1 ? '' : filePath.slice(dot).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

export interface DashboardServer {
  /** Loopback URL the dashboard is served from, e.g. `http://127.0.0.1:53124`. */
  readonly url: string;
  /** Underlying WebSocket server — attach `connection` handlers for the live channel. */
  readonly wss: WebSocketServer;
  /** Send a message to every connected dashboard client. */
  broadcast(message: ServerMessage): void;
  close(): Promise<void>;
}

export interface DashboardServerOptions {
  /** Directory of built dashboard assets to serve. Defaults to `dist/dashboard`. */
  readonly dashboardDir?: string;
}

/**
 * Start the local dashboard server, bound to loopback on an OS-assigned port.
 * Serves the built dashboard (or the placeholder) over HTTP and upgrades
 * WebSocket connections on the same port.
 */
export async function createDashboardServer(
  options: DashboardServerOptions = {},
): Promise<DashboardServer> {
  const dashboardDir = options.dashboardDir ?? DASHBOARD_DIR;
  const http = createServer((req, res) => {
    void serve(dashboardDir, req.url ?? '/', res);
  });
  const wss = new WebSocketServer({ server: http });

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    // Loopback only — this is a local dev tool, never exposed to the network.
    http.listen(0, '127.0.0.1', resolve);
  });

  const address = http.address();
  if (address === null || typeof address === 'string') {
    throw new Error('dashboard server failed to bind to a TCP port');
  }
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    wss,
    broadcast(message) {
      const data = JSON.stringify(message);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(data);
      }
    },
    close() {
      return new Promise<void>((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => http.close(() => resolve()));
      });
    },
  };
}

async function serve(dashboardDir: string, rawUrl: string, res: ServerResponse): Promise<void> {
  const pathname = rawUrl.split('?')[0] ?? '/';
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = normalize(join(dashboardDir, relative));

  // Path-traversal guard: the resolved file must stay inside the dashboard dir.
  if (filePath !== dashboardDir && !filePath.startsWith(dashboardDir + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isFile()) {
      res.writeHead(200, { 'content-type': contentTypeFor(filePath) });
      createReadStream(filePath).pipe(res);
      return;
    }
  } catch {
    // No such file — fall through to the placeholder / 404.
  }

  // No built dashboard yet (or an unknown path): serve the placeholder at root.
  if (pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PLACEHOLDER_HTML);
    return;
  }
  res.writeHead(404).end('Not found');
}
