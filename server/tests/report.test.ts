import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const repo = vi.hoisted(() => ({ searchEvents: vi.fn(), readSnapshot: vi.fn(), report: vi.fn(), findEvent: vi.fn(), countLogs: vi.fn(), logs: vi.fn() }));
vi.mock('../src/modules/reports/report.repository.js', () => repo);
import { getReport, getLogs } from '../src/modules/reports/report.service.js';
import { logQuerySchema, reportQuerySchema } from '../src/modules/reports/report.schema.js';
import { logsWorkbook, reportWorkbook } from '../src/modules/reports/report.export.js';
const query = { eventId: 1, page: 1, limit: 20 };
beforeEach(() => {
  vi.resetAllMocks(); repo.readSnapshot.mockImplementation((work) => work({}));
  repo.findEvent.mockResolvedValue({ id: 1 }); repo.countLogs.mockResolvedValue(45); repo.logs.mockResolvedValue([]);
});
describe('report validation', () => {
  it.each([
    { eventId: 0 }, { eventId: 1, from: '2026-02-30' }, { eventId: 1, from: '2026-09-20', to: '2026-09-01' },
    { eventId: 1, from: "2026-01-01' OR 1=1" }, { eventId: 1, extra: true },
  ])('rejects invalid report filters %j', (input) => expect(reportQuerySchema.safeParse(input).success).toBe(false));
  it('accepts leap dates and a one-day inclusive range', () => expect(reportQuerySchema.safeParse({ eventId: '1', from: '2024-02-29', to: '2024-02-29' }).success).toBe(true));
  it.each([{ ...query, page: 0 }, { ...query, limit: 101 }, { ...query, staffId: -1 }, { ...query, result: 'fake' }])('rejects invalid log filters %j', (input) => expect(logQuerySchema.safeParse(input).success).toBe(false));
});
it('returns 404 for a missing Event instead of an empty report', async () => {
  repo.report.mockResolvedValue(undefined);
  await expect(getReport({ eventId: 1 })).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' });
});
it('paginates without changing the selected filters', async () => {
  await getLogs({ ...query, page: 3, staffId: 4, result: 'INVALID' });
  expect(repo.logs).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ staffId: 4, result: 'INVALID' }), 20, 40);
});
it('exports all matching rows rather than only the current page', async () => {
  await getLogs({ ...query, page: 3 }, true);
  expect(repo.logs).toHaveBeenCalledWith(expect.anything(), expect.anything(), 10000, 0);
});
it('refuses an oversized export before loading rows', async () => {
  repo.countLogs.mockResolvedValue(10001);
  await expect(getLogs(query, true)).rejects.toMatchObject({ code: 'EXPORT_TOO_LARGE' });
  expect(repo.logs).not.toHaveBeenCalled();
});
it('creates a real XLSX with numeric revenue and treats formula-looking event names as text', async () => {
  const report = { id: 1, name: '=1+1', status: 'cancelled', confirmedOrders: 2, soldTickets: 4, issuedTickets: 4,
    admissions: 2, scans: 5, rejectedScans: 3, grossRevenue: 100, refundedAmount: 150, netRevenue: -50 };
  const buffer = await reportWorkbook({ eventId: 1, from: '2026-09-01' }, report as never);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('Báo cáo sự kiện')!;
  expect(sheet.getCell('A2').value).toBe('=1+1');
  expect(sheet.getCell('K2').value).toBe(-50);
  expect(sheet.getCell('K2').type).toBe(ExcelJS.ValueType.Number);
});
it('keeps invalid scans with a null ticket in the XLSX and includes filters', async () => {
  const buffer = await logsWorkbook({ eventId: 1, staffId: 2, result: 'INVALID' }, [{ id: 1, eventName: '@event', staffId: 2,
    staffName: '=HYPERLINK("bad")', ticketCode: null, result: 'INVALID', scannedCode: '***123', message: 'Mã sai', checkedAt: new Date('2026-09-15T00:00:00Z') } as never]);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('Lịch sử check-in')!;
  expect(sheet.rowCount).toBe(2);
  expect(sheet.getCell('D2').type).toBe(ExcelJS.ValueType.String);
  expect(sheet.getCell('E2').value).toBeNull();
  expect(sheet.getCell('I2').value).toContain('07:00:00');
});
