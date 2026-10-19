import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import type { AdminSignalFingerprint } from '../src/modules/dashboard/admin-dashboard.repository.js';
import { publishEventStatusChanges } from '../src/modules/events/event-status.publisher.js';
import { changedTopics, CLOSE, createAdminSignalsGateway, type AdminSignalsGateway } from '../src/realtime/admin-signals.gateway.js';
import { createEventRealtimeGateway, type EventRealtimeGateway } from '../src/realtime/event-status.gateway.js';
import type { TokenPayload } from '../src/utils/jwt.js';

const SECRET = 'test-secret-for-admin-signals-gateway-0123456789';
const ORIGIN = 'http://127.0.0.1:5173';
const base: AdminSignalFingerprint = {
  staff: '0:0', refunds: '0:', publishFailures: '0:', pendingOrders: '0:0', confirmedOrders: '0:', checkins: '0:0', events: '1:x', staffing: '0:0:',
};

let server: Server;
let port = 0;
let gateway: AdminSignalsGateway;
let events: EventRealtimeGateway;
let fingerprint: AdminSignalFingerprint;
const activeAdmins = new Set([1]);
const sign = (payload: TokenPayload, expiresIn: jwt.SignOptions['expiresIn'] = '15m') => jwt.sign(payload, SECRET, { expiresIn });

function open(path = '/ws/admin', origin: string | undefined = ORIGIN) {
  return new WebSocket(`ws://127.0.0.1:${port}${path}`, origin ? { origin } : {});
}

/** Collects messages and resolves the close event. */
function track(socket: WebSocket) {
  const messages: Array<Record<string, unknown>> = [];
  socket.on('message', (data) => messages.push(JSON.parse(String(data))));
  const closed = new Promise<{ code: number; reason: string }>((resolve) => socket.on('close', (code, reason) => resolve({ code, reason: String(reason) })));
  const opened = new Promise<void>((resolve, reject) => { socket.on('open', () => resolve()); socket.on('error', reject); });
  const waitFor = async (type: string, timeout = 2000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const found = messages.find((m) => m.type === type);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no ${type} message`);
  };
  return { messages, closed, opened, waitFor };
}

beforeEach(async () => {
  fingerprint = { ...base };
  server = createServer((_req, res) => { res.statusCode = 404; res.end(); });
  events = createEventRealtimeGateway(server);
  gateway = createAdminSignalsGateway(server, {
    verifyToken: (token) => jwt.verify(token, SECRET) as TokenPayload,
    findActiveAdmin: async (userId) => activeAdmins.has(userId),
    fingerprint: async () => ({ ...fingerprint }),
    allowedOrigins: [ORIGIN],
    pollMs: 40,
    authTimeoutMs: 150,
    log: () => {},
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await gateway.close();
  await events.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Admin realtime channel (/ws/admin)', () => {
  it('reports only the topics whose marker changed', () => {
    expect(changedTopics(null, base)).toEqual([]);
    expect(changedTopics(base, { ...base, staff: '1:9', checkins: '3:40' })).toEqual(['staff', 'checkins']);
  });

  it('closes an unauthenticated socket after the auth timeout and never sends it data', async () => {
    const socket = open();
    const t = track(socket);
    await t.opened;
    const result = await t.closed;
    expect(result.code).toBe(CLOSE.unauthenticated);
    expect(t.messages).toEqual([]);
  });

  it('rejects invalid tokens, Staff tokens and inactive Admins', async () => {
    for (const [token, code] of [
      ['not-a-jwt', CLOSE.unauthenticated],
      [sign({ userId: 1, email: 'a@x.vn', role: 'admin' }, -10), CLOSE.unauthenticated],
      [sign({ userId: 5, email: 's@x.vn', role: 'staff' }), CLOSE.forbidden],
      [sign({ userId: 2, email: 'b@x.vn', role: 'admin' }), CLOSE.forbidden],
    ] as const) {
      const socket = open();
      const t = track(socket);
      await t.opened;
      socket.send(JSON.stringify({ type: 'auth', token }));
      expect((await t.closed).code, String(token).slice(0, 12)).toBe(code);
      expect(t.messages.some((m) => m.type === 'admin.ready')).toBe(false);
    }
  });

  it('refuses a browser origin other than the Admin client', async () => {
    const socket = open('/ws/admin', 'http://evil.example');
    const failed = await new Promise<string>((resolve) => socket.on('unexpected-response', (_req, res) => resolve(String(res.statusCode))).on('error', () => resolve('error')));
    expect(failed).toBe('403');
  });

  it('pushes changed topics (no business data) to authenticated Admins only', async () => {
    const admin = open();
    const a = track(admin);
    await a.opened;
    admin.send(JSON.stringify({ type: 'auth', token: sign({ userId: 1, email: 'a@x.vn', role: 'admin' }) }));
    const ready = await a.waitFor('admin.ready');
    expect(typeof ready.expiresAt).toBe('string');

    const anonymous = open();
    const b = track(anonymous);
    await b.opened;

    await new Promise((r) => setTimeout(r, 80)); // baseline fingerprint taken
    fingerprint = { ...fingerprint, staff: '1:12' };
    const change = await a.waitFor('admin.signals.changed');
    expect(change.topics).toEqual(['staff']);
    expect(Object.keys(change).sort()).toEqual(['occurredAt', 'topics', 'type']);
    expect(b.messages.some((m) => m.type === 'admin.signals.changed')).toBe(false);
    admin.close();
    anonymous.close();
  });

  it('forwards Event lifecycle pushes and closes the socket when the token expires', async () => {
    const admin = open();
    const a = track(admin);
    await a.opened;
    admin.send(JSON.stringify({ type: 'auth', token: sign({ userId: 1, email: 'a@x.vn', role: 'admin' }, 1) }));
    await a.waitFor('admin.ready');
    publishEventStatusChanges([{ eventId: 7, status: 'ongoing' }]);
    const change = await a.waitFor('admin.signals.changed');
    expect(change.topics).toEqual(['eventLifecycle']);
    expect((await a.closed).code).toBe(CLOSE.unauthenticated);
  }, 4000);

  it('shares the HTTP server with /ws/events and rejects unknown socket paths', async () => {
    const publicSocket = open('/ws/events', undefined);
    const p = track(publicSocket);
    await p.opened;
    publishEventStatusChanges([{ eventId: 3, status: 'completed' }]);
    const lifecycle = await p.waitFor('event.lifecycle.updated');
    expect(lifecycle.changes).toEqual([{ eventId: 3, status: 'completed' }]);
    publicSocket.close();

    const stray = open('/ws/unknown', undefined);
    const status = await new Promise<string>((resolve) => stray.on('unexpected-response', (_req, res) => resolve(String(res.statusCode))).on('error', () => resolve('error')));
    expect(status).toBe('404');
  });
});
