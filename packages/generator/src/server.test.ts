import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { DashboardServer } from './server';
import { createDashboardServer } from './server';

describe('createDashboardServer', () => {
  let server: DashboardServer;

  beforeEach(async () => {
    server = await createDashboardServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('binds to loopback on an OS-assigned port', () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('serves the placeholder dashboard at the root', async () => {
    const res = await fetch(server.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('HumanJS');
  });

  it('404s an unknown asset (no built dashboard yet)', async () => {
    const res = await fetch(`${server.url}/does-not-exist.js`);
    expect(res.status).toBe(404);
  });

  it('broadcasts a message to connected clients', async () => {
    const wsUrl = server.url.replace(/^http/, 'ws');
    const client = new WebSocket(wsUrl);

    const received = await new Promise<string>((resolve, reject) => {
      client.on('open', () => server.broadcast({ type: 'exported', path: '/tmp/out.spec.ts' }));
      client.on('message', (data) => resolve(data.toString()));
      client.on('error', reject);
    });
    client.close();

    expect(JSON.parse(received)).toEqual({ type: 'exported', path: '/tmp/out.spec.ts' });
  });
});
