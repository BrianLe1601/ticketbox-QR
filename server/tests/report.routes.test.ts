/// <reference path="../src/types/express.d.ts" />
import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/middlewares/authenticate.js', () => ({ authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.headers.authorization) { res.status(401).end(); return; }
  const [role, id] = String(req.headers.authorization).split(':');
  req.authUser = { id: Number(id ?? 7), fullName: 'Test', email: 'test@example.com', role: role === 'admin' ? 'admin' : 'staff' }; next();
} }));
const service = vi.hoisted(() => ({
  searchEvents: vi.fn(), getReport: vi.fn(), getReportForExport: vi.fn(), getLogs: vi.fn(), getLogsForExport: vi.fn(),
}));
vi.mock('../src/modules/reports/report.service.js', () => ({ ...service, ALL_EVENTS_LABEL: 'Tất cả sự kiện' }));
import { adminReportsRouter, adminCheckinsRouter } from '../src/modules/reports/report.routes.js';
import ExcelJS from 'exceljs';
const app = express(); app.use('/reports', adminReportsRouter); app.use('/checkins', adminCheckinsRouter);
app.use((err: { statusCode?: number; code?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(err.statusCode ?? 500).json({ code: err.code }); });
const binary = (response: request.Response, callback: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', callback as never);
};
const reportData = (over = {}) => ({
  scope: { type: 'event', eventId: 7, eventName: 'Demo', eventStatus: 'ongoing' },
  filters: { eventId: 7, from: '2026-10-01', to: '2026-10-31', groupBy: 'month' }, generatedAt: '2026-10-17T03:00:00.000Z',
  totals: { confirmedOrders: 1, soldTickets: 2, capacity: 10, fillRate: 20, issuedTickets: 2, admissions: 1, attendanceRate: 50, scans: 1, rejectedScans: 0, grossRevenue: 100, refundedAmount: 0, netRevenue: 100 },
  rates: {}, events: [{ id: 7, name: 'Demo', status: 'ongoing', confirmedOrders: 1, soldTickets: 2, capacity: 10, fillRate: 20, issuedTickets: 2, admissions: 1, attendanceRate: 50, scans: 1, rejectedScans: 0, grossRevenue: 100, refundedAmount: 0, netRevenue: 100 }],
  revenueSeries: [{ period: '2026-10', grossRevenue: 100, refundedAmount: 0, netRevenue: 100 }], ...over,
});
beforeEach(() => {
  vi.resetAllMocks();
  service.getReport.mockResolvedValue({ id: 1 });
  service.getLogs.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20 } });
  service.searchEvents.mockResolvedValue({ items: [], meta: { total: 0, page: 1, limit: 20 } });
});
const staffPaths = ['/reports?eventId=1', '/reports', '/reports/events', '/reports/export?eventId=1', '/reports/export', '/checkins?eventId=1', '/checkins', '/checkins/export?eventId=1', '/checkins/export'];
it.each(staffPaths)('blocks Staff from %s', async (path) => {
  expect((await request(app).get(path).set('Authorization', 'staff:7')).status).toBe(403);
  expect(service.getReport).not.toHaveBeenCalled();
  expect(service.getLogs).not.toHaveBeenCalled();
  expect(service.getReportForExport).not.toHaveBeenCalled();
  expect(service.getLogsForExport).not.toHaveBeenCalled();
  expect(service.searchEvents).not.toHaveBeenCalled();
});
it.each(staffPaths)('requires authentication for %s', async (path) => { expect((await request(app).get(path)).status).toBe(401); });
it('treats a missing Event as "all Events" for reports, logs and the Event picker', async () => {
  expect((await request(app).get('/reports').set('Authorization', 'admin:7')).status).toBe(200);
  expect(service.getReport).toHaveBeenCalledWith({ groupBy: 'day', page: 1, limit: 20 }, 7);
  expect((await request(app).get('/checkins').set('Authorization', 'admin:7')).status).toBe(200);
  expect(service.getLogs).toHaveBeenCalledWith({ page: 1, limit: 20 }, 7);
  expect((await request(app).get('/reports/events?q=rock&page=2').set('Authorization', 'admin:7')).status).toBe(200);
  expect(service.searchEvents).toHaveBeenCalledWith({ q: 'rock', page: 2, limit: 20 });
});
it('returns an Admin report with no-store caching, passing the authenticated Admin id to the service', async () => {
  const res = await request(app).get('/reports?eventId=1').set('Authorization', 'admin:42');
  expect(res.status).toBe(200); expect(res.headers['cache-control']).toBe('no-store');
  expect(service.getReport).toHaveBeenCalledWith({ eventId: 1, groupBy: 'day', page: 1, limit: 20 }, 42);
});
it.each(['/reports?eventId=abc', '/reports?snapshotId=nope', '/checkins?limit=500', '/reports/events?limit=51'])('rejects malformed query %s before reaching the service', async (path) => {
  expect((await request(app).get(path).set('Authorization', 'admin:7')).status).toBe(400);
  expect(service.getReport).not.toHaveBeenCalled(); expect(service.getLogs).not.toHaveBeenCalled(); expect(service.searchEvents).not.toHaveBeenCalled();
});
it('passes a snapshot id and the Admin id so the service can bind it', async () => {
  const snapshotId = 'S'.repeat(32);
  await request(app).get(`/reports/export?snapshotId=${snapshotId}`).set('Authorization', 'admin:5');
  expect(service.getReportForExport).toHaveBeenCalledWith(expect.objectContaining({ snapshotId }), 5);
  await request(app).get(`/checkins/export?snapshotId=${snapshotId}`).set('Authorization', 'admin:5');
  expect(service.getLogsForExport).toHaveBeenCalledWith(expect.objectContaining({ snapshotId }), 5);
});
it('maps a stale or foreign snapshot to 410 without leaking details', async () => {
  const error = Object.assign(new Error('gone'), { statusCode: 410, code: 'SNAPSHOT_EXPIRED' });
  service.getReportForExport.mockRejectedValue(error);
  const res = await request(app).get(`/reports/export?snapshotId=${'S'.repeat(32)}`).set('Authorization', 'admin:5');
  expect(res.status).toBe(410); expect(res.body).toEqual({ code: 'SNAPSHOT_EXPIRED' });
});

it('exports the same validated Event/date/group filters as the on-screen report', async () => {
  service.getReportForExport.mockResolvedValue(reportData());
  const res = await request(app).get('/reports/export?eventId=7&from=2026-10-01&to=2026-10-31&groupBy=month')
    .set('Authorization', 'admin:7').buffer(true).parse(binary);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
  expect(res.headers['content-disposition']).toContain('ticketbox-report-7.xlsx');
  expect(res.headers['cache-control']).toBe('no-store');
  expect(service.getReportForExport).toHaveBeenCalledWith({ eventId: 7, from: '2026-10-01', to: '2026-10-31', groupBy: 'month', page: 1, limit: 20 }, 7);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(res.body);
  const info = JSON.stringify(book.getWorksheet('Tổng quan')!.getSheetValues());
  expect(info).toContain('Tháng');
  expect(info).toContain('Từ 01/10/2026 đến hết 31/10/2026');
  expect(book.getWorksheet('Theo sự kiện')!.getCell('M2').value).toBe(100);
  const period = book.getWorksheet('Doanh thu theo kỳ')!.getCell('A2');
  expect((period.value as Date).toISOString()).toBe('2026-10-01T00:00:00.000Z');
  expect(period.numFmt).toBe('mm/yyyy');
});
it('names an all-Events export accordingly', async () => {
  service.getReportForExport.mockResolvedValue(reportData({ scope: { type: 'all', eventId: null, eventName: null, eventStatus: null }, filters: { eventId: null, from: null, to: null, groupBy: 'day' } }));
  const res = await request(app).get('/reports/export').set('Authorization', 'admin:7').buffer(true).parse(binary);
  expect(res.headers['content-disposition']).toContain('ticketbox-report-all.xlsx');
});
