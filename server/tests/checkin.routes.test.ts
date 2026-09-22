import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/middlewares/authenticate.js', () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) { res.status(401).json({ success: false }); return; }
    req.authUser = { id: 2, fullName: 'Test', email: 'test@example.com', role: req.headers.authorization === 'admin' ? 'admin' : 'staff' };
    next();
  },
}));
const service = vi.hoisted(() => ({ getAssignedEvents: vi.fn(), getRecentLogs: vi.fn(), checkIn: vi.fn() }));
vi.mock('../src/modules/checkins/checkin.service.js', () => service);
import { checkinRouter } from '../src/modules/checkins/checkin.routes.js';
const app = express();
app.use(express.json());
app.use('/api/staff', checkinRouter);
app.use((err: { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(err.statusCode ?? 500).json({ success: false }); });
beforeEach(() => { vi.resetAllMocks(); service.getAssignedEvents.mockResolvedValue([]); service.checkIn.mockResolvedValue({ code: 'SUCCESS' }); });
it('requires login', async () => { expect((await request(app).get('/api/staff/events')).status).toBe(401); });
it('does not allow Admin to impersonate gate Staff', async () => {
  expect((await request(app).post('/api/staff/events/1/checkins').set('Authorization', 'admin').send({ code: 'TKT-123' })).status).toBe(403);
  expect(service.checkIn).not.toHaveBeenCalled();
});
it.each(['0', '-1', 'abc', '1.5', '9007199254740992'])('rejects invalid Event ID %s', async (id) => {
  expect((await request(app).post(`/api/staff/events/${id}/checkins`).set('Authorization', 'staff').send({ code: 'TKT-123' })).status).toBe(400);
  expect(service.checkIn).not.toHaveBeenCalled();
});
it.each([{}, { code: '' }, { code: ' '.repeat(3) }, { code: 'x'.repeat(513) }, { code: 'TKT-123', staffId: 7 }])('rejects malformed or spoofed payload %j', async (body) => {
  expect((await request(app).post('/api/staff/events/1/checkins').set('Authorization', 'staff').send(body)).status).toBe(400);
  expect(service.checkIn).not.toHaveBeenCalled();
});
it('uses the authenticated Staff ID and validated code', async () => {
  const response = await request(app).post('/api/staff/events/1/checkins').set('Authorization', 'staff').send({ code: ' TKT-123 ' });
  expect(response.status).toBe(200);
  expect(service.checkIn).toHaveBeenCalledWith(1, 2, 'TKT-123');
});
