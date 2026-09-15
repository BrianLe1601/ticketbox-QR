import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/middlewares/authenticate.js', () => ({ authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.headers.authorization) { res.status(401).end(); return; }
  req.authUser = { id: 7, fullName: 'Test', email: 'test@example.com', role: req.headers.authorization === 'admin' ? 'admin' : 'staff' }; next();
} }));
const service = vi.hoisted(() => ({ searchEvents: vi.fn(), getReport: vi.fn(), getLogs: vi.fn() }));
vi.mock('../src/modules/reports/report.service.js', () => service);
import { adminReportsRouter, adminCheckinsRouter } from '../src/modules/reports/report.routes.js';
const app = express(); app.use('/reports', adminReportsRouter); app.use('/checkins', adminCheckinsRouter);
app.use((err: { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(err.statusCode ?? 500).end(); });
beforeEach(() => { vi.resetAllMocks(); service.getReport.mockResolvedValue({ id: 1 }); });
it.each(['/reports?eventId=1', '/reports/export?eventId=1', '/checkins?eventId=1', '/checkins/export?eventId=1'])('blocks Staff from %s', async (path) => {
  expect((await request(app).get(path).set('Authorization', 'staff')).status).toBe(403);
});
it('requires authentication', async () => { expect((await request(app).get('/reports?eventId=1')).status).toBe(401); });
it('requires an Event before running report queries', async () => {
  expect((await request(app).get('/reports').set('Authorization', 'admin')).status).toBe(400);
  expect(service.getReport).not.toHaveBeenCalled();
});
it('returns an Admin report with no-store caching', async () => {
  const res = await request(app).get('/reports?eventId=1').set('Authorization', 'admin');
  expect(res.status).toBe(200); expect(res.headers['cache-control']).toBe('no-store');
  expect(service.getReport).toHaveBeenCalledWith({ eventId: 1 });
});
