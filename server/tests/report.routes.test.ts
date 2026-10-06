/// <reference path="../src/types/express.d.ts" />
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
import ExcelJS from 'exceljs';
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
  expect(service.getReport).toHaveBeenCalledWith({ eventId: 1, groupBy: 'day' });
});

it('exports the same validated Event/date/group filters as the on-screen report', async () => {
  service.getReport.mockResolvedValue({
    id: 7, name: 'Demo', status: 'ongoing', confirmedOrders: 1, soldTickets: 2,
    capacity: 10, fillRate: 20, issuedTickets: 2, admissions: 1,
    attendanceRate: 50, scans: 1, rejectedScans: 0,
    grossRevenue: 100, refundedAmount: 0, netRevenue: 100,
    revenueSeries: [{ period: '2026-10', grossRevenue: 100, refundedAmount: 0, netRevenue: 100 }],
  });
  const res = await request(app).get('/reports/export?eventId=7&from=2026-10-01&to=2026-10-31&groupBy=month')
    .set('Authorization', 'admin').buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => callback(null, Buffer.concat(chunks)));
      response.on('error', callback);
    });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
  expect(res.headers['content-disposition']).toContain('ticketbox-report-7.xlsx');
  expect(res.headers['cache-control']).toBe('no-store');
  expect(service.getReport).toHaveBeenCalledWith({ eventId: 7, from: '2026-10-01', to: '2026-10-31', groupBy: 'month' });
  const book = new ExcelJS.Workbook(); await book.xlsx.load(res.body);
  expect(book.getWorksheet('Bộ lọc')!.getCell('B5').value).toBe('Tháng');
  expect(book.getWorksheet('Báo cáo sự kiện')!.getCell('L2').value).toBe(100);
  expect(book.getWorksheet('Doanh thu theo kỳ')!.getCell('A2').value).toBe('2026-10');
});
