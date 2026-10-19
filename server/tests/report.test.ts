import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const repo = vi.hoisted(() => ({
  MAX_REPORT_EVENTS: 2000,
  searchEvents: vi.fn(), readSnapshot: vi.fn(), reportRows: vi.fn(), revenueSeries: vi.fn(), findEvent: vi.fn(),
  maxLogId: vi.fn(), countLogs: vi.fn(), logStats: vi.fn(), logs: vi.fn(),
}));
vi.mock('../src/modules/reports/report.repository.js', () => repo);
import { getLogs, getLogsForExport, getReport, getReportForExport, searchEvents } from '../src/modules/reports/report.service.js';
import { eventSearchSchema, logQuerySchema, reportQuerySchema } from '../src/modules/reports/report.schema.js';
import { logsWorkbook } from '../src/modules/reports/report.export.js';
import { clearSnapshots, SNAPSHOT_TTL_SECONDS } from '../src/modules/reports/report.snapshot.js';

const ADMIN = 7;
const query = { page: 1, limit: 20 };
const base = { groupBy: 'day' as const, page: 1, limit: 20 };
const counts = { confirmedOrders: 0, soldTickets: 0, issuedTickets: 0, admissions: 0, scans: 0, rejectedScans: 0, capacity: 0, grossRevenue: 0, refundedAmount: 0, netRevenue: 0, fillRate: 0, attendanceRate: 0 };
const row = (id: number, status: string, over: Partial<typeof counts> = {}) => ({ id, name: `Event ${id}`, status, startTime: new Date('2026-10-01T10:00:00Z'), ...counts, ...over });

beforeEach(() => {
  vi.resetAllMocks(); clearSnapshots();
  repo.readSnapshot.mockImplementation((work) => work({}));
  repo.findEvent.mockResolvedValue({ id: 1, name: 'Demo', status: 'completed' });
  repo.reportRows.mockResolvedValue([row(1, 'completed')]);
  repo.revenueSeries.mockResolvedValue([]);
  repo.maxLogId.mockResolvedValue(500);
  repo.countLogs.mockResolvedValue(45);
  repo.logStats.mockResolvedValue({ total: 45, success: 20, rejected: 25, duplicate: 4, invalid: 3 });
  repo.logs.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('report validation', () => {
  it.each([
    { eventId: 0 }, { eventId: 1, from: '2026-02-30' }, { eventId: 1, from: '2026-09-20', to: '2026-09-01' },
    { eventId: 1, from: "2026-01-01' OR 1=1" }, { eventId: 1, extra: true }, { snapshotId: 'short' }, { snapshotId: 'x'.repeat(22) + '!' },
    { limit: 51 }, { page: 0 },
  ])('rejects invalid report filters %j', (input) => expect(reportQuerySchema.safeParse(input).success).toBe(false));
  it('treats a missing eventId as "all Events" and still accepts a single Event', () => {
    expect(reportQuerySchema.safeParse({}).success).toBe(true);
    expect(reportQuerySchema.parse({ eventId: '3' }).eventId).toBe(3);
  });
  it('accepts leap dates and a one-day inclusive range', () => expect(reportQuerySchema.safeParse({ eventId: '1', from: '2024-02-29', to: '2024-02-29' }).success).toBe(true));
  it.each([{ ...query, page: 0 }, { ...query, limit: 101 }, { ...query, staffId: -1 }, { ...query, result: 'fake' }])('rejects invalid log filters %j', (input) => expect(logQuerySchema.safeParse(input).success).toBe(false));
  it('paginates Event options within bounds', () => {
    expect(eventSearchSchema.safeParse({ q: ' abc ', page: '2', limit: '50' }).success).toBe(true);
    expect(eventSearchSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(eventSearchSchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});

describe('Event options', () => {
  it('returns a paginated envelope instead of a silent 100-row cut', async () => {
    repo.searchEvents.mockResolvedValue({ rows: [{ id: 1 }], total: 230 });
    expect(await searchEvents({ q: '', page: 3, limit: 50 })).toEqual({ items: [{ id: 1 }], meta: { total: 230, page: 3, limit: 50 } });
  });
});

describe('single-Event report (original contract)', () => {
  it('returns 404 for a missing Event instead of an empty report', async () => {
    repo.findEvent.mockResolvedValue(undefined);
    await expect(getReport({ ...base, eventId: 1 }, ADMIN)).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' });
  });
  it('keeps the flat single-Event fields next to the new scope data', async () => {
    repo.reportRows.mockResolvedValue([row(1, 'completed', { soldTickets: 4, capacity: 10, fillRate: 40 })]);
    const payload = await getReport({ ...base, eventId: 1 }, ADMIN);
    expect(payload).toMatchObject({ id: 1, name: 'Demo', status: 'completed', soldTickets: 4, capacity: 10, fillRate: 40 });
    expect(payload.scope).toMatchObject({ type: 'event', eventId: 1, eventCount: 1 });
  });
});

describe('All Events report', () => {
  it('sums numerators and denominators instead of averaging per-Event percentages', async () => {
    repo.reportRows.mockResolvedValue([
      row(1, 'completed', { soldTickets: 5, capacity: 10, admissions: 5, fillRate: 50, attendanceRate: 100 }),
      row(2, 'completed', { soldTickets: 10, capacity: 1000, admissions: 1, fillRate: 1, attendanceRate: 10 }),
    ]);
    const payload = await getReport(base, ADMIN);
    // Averaging 50% and 1% would claim 25.5%; the real basis is 15 / 1010.
    expect(payload.rates.fillRate).toEqual({ numerator: 15, denominator: 1010, percent: 1.49 });
    // Averaging 100% and 10% would claim 55%; the real basis is 6 / 15.
    expect(payload.rates.attendanceRate).toEqual({ numerator: 6, denominator: 15, percent: 40 });
    expect(payload).toMatchObject({ fillRate: 1.49, attendanceRate: 40, name: 'Tất cả sự kiện', status: 'all', id: null });
  });
  it('keeps terminal and zero-activity Events in the breakdown instead of omitting them', async () => {
    repo.reportRows.mockResolvedValue([row(1, 'ongoing'), row(2, 'completed'), row(3, 'cancelled', { soldTickets: 2, capacity: 10 }), row(4, 'published')]);
    const payload = await getReport(base, ADMIN);
    expect(payload.breakdown.items.map((event) => event.status)).toEqual(['ongoing', 'completed', 'cancelled', 'published']);
    expect(payload.scope).toMatchObject({ type: 'all', eventId: null, eventCount: 4 });
    expect(repo.findEvent).not.toHaveBeenCalled();
  });
  it('adds money from independent sources and allows negative net revenue', async () => {
    repo.reportRows.mockResolvedValue([
      row(1, 'cancelled', { grossRevenue: 100_000, refundedAmount: 150_000 }), row(2, 'completed', { grossRevenue: 50_000, refundedAmount: 0 }),
    ]);
    const payload = await getReport(base, ADMIN);
    expect(payload).toMatchObject({ grossRevenue: 150_000, refundedAmount: 150_000, netRevenue: 0 });
  });
  it('refuses an oversized scope rather than truncating it', async () => {
    repo.reportRows.mockResolvedValue(Array.from({ length: 2001 }, (_, index) => row(index + 1, 'completed')));
    await expect(getReport(base, ADMIN)).rejects.toMatchObject({ code: 'REPORT_SCOPE_TOO_LARGE' });
  });
  it('paginates the breakdown from the captured snapshot without recomputing', async () => {
    repo.reportRows.mockResolvedValue(Array.from({ length: 45 }, (_, index) => row(index + 1, 'completed')));
    const first = await getReport({ ...base, limit: 20 }, ADMIN);
    expect(first.breakdown.meta).toEqual({ total: 45, page: 1, limit: 20 });
    const third = await getReport({ ...base, limit: 20, page: 3, snapshotId: first.snapshot.id }, ADMIN);
    expect(third.breakdown.items).toHaveLength(5);
    expect(third.snapshot.generatedAt).toBe(first.snapshot.generatedAt);
    expect(repo.reportRows).toHaveBeenCalledTimes(1);
  });
});

describe('report snapshot', () => {
  it('exports exactly the data on screen even if the database moved on', async () => {
    repo.reportRows.mockResolvedValueOnce([row(1, 'completed', { grossRevenue: 100 })]);
    const view = await getReport(base, ADMIN);
    repo.reportRows.mockResolvedValue([row(1, 'completed', { grossRevenue: 999 })]);
    const exported = await getReportForExport({ ...base, snapshotId: view.snapshot.id }, ADMIN);
    expect(exported.totals.grossRevenue).toBe(100);
    expect(exported.generatedAt).toBe(view.snapshot.generatedAt);
    expect(repo.reportRows).toHaveBeenCalledTimes(1);
  });
  it('shows one capture time on screen, in the snapshot and in the file even when the query is slow', async () => {
    repo.reportRows.mockImplementation(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); return [row(1, 'completed')]; });
    repo.logs.mockImplementation(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); return []; });
    const view = await getReport(base, ADMIN);
    expect((await getReportForExport({ ...base, snapshotId: view.snapshot.id }, ADMIN)).generatedAt).toBe(view.snapshot.generatedAt);
    const logs = await getLogs(query, ADMIN);
    expect((await getLogsForExport({ ...query, snapshotId: logs.meta.snapshot.id }, ADMIN)).data.generatedAt).toBe(logs.meta.snapshot.generatedAt);
  });
  it('rejects a changed filter instead of exporting a different scope', async () => {
    const view = await getReport({ ...base, from: '2026-10-01' }, ADMIN);
    await expect(getReportForExport({ ...base, from: '2026-10-02', snapshotId: view.snapshot.id }, ADMIN))
      .rejects.toMatchObject({ code: 'SNAPSHOT_FILTER_MISMATCH', statusCode: 409 });
    await expect(getReport({ ...base, eventId: 1, snapshotId: view.snapshot.id }, ADMIN)).rejects.toMatchObject({ code: 'SNAPSHOT_FILTER_MISMATCH' });
  });
  it("never serves another Admin's snapshot and does not reveal that it exists", async () => {
    const view = await getReport(base, ADMIN);
    await expect(getReport({ ...base, snapshotId: view.snapshot.id }, ADMIN + 1)).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED', statusCode: 410 });
    await expect(getReportForExport({ ...base, snapshotId: view.snapshot.id }, ADMIN + 1)).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
    await expect(getReport({ ...base, snapshotId: 'A'.repeat(32) }, ADMIN)).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
  });
  it('is not accepted by the other view kind', async () => {
    const view = await getReport(base, ADMIN);
    await expect(getLogs({ ...query, snapshotId: view.snapshot.id }, ADMIN)).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
  });
  it('expires after its time to live', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const view = await getReport(base, ADMIN);
    vi.setSystemTime(Date.now() + (SNAPSHOT_TTL_SECONDS - 1) * 1000);
    await expect(getReport({ ...base, snapshotId: view.snapshot.id }, ADMIN)).resolves.toBeDefined();
    vi.setSystemTime(Date.now() + 2000);
    await expect(getReport({ ...base, snapshotId: view.snapshot.id }, ADMIN)).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
    await expect(getReportForExport({ ...base, snapshotId: view.snapshot.id }, ADMIN)).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
  });
  it('limits how many snapshots one Admin can keep', async () => {
    const first = await getReport(base, ADMIN);
    for (let index = 0; index < 20; index++) await getReport(base, ADMIN);
    await expect(getReport({ ...base, snapshotId: first.snapshot.id }, ADMIN)).rejects.toMatchObject({ code: 'SNAPSHOT_EXPIRED' });
  });
});

describe('check-in logs', () => {
  it('shows all Events by default without requiring an Event lookup', async () => {
    const result = await getLogs(query, ADMIN);
    expect(repo.findEvent).not.toHaveBeenCalled();
    expect(repo.logs).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: undefined }), 500, 20, 0);
    expect(result.meta.scope).toEqual({ type: 'all', eventId: null, eventName: null });
  });
  it('returns 404 when a requested Event does not exist', async () => {
    repo.findEvent.mockResolvedValue(undefined);
    await expect(getLogs({ ...query, eventId: 9 }, ADMIN)).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' });
  });
  it('paginates without changing the selected filters or the captured log watermark', async () => {
    const first = await getLogs({ ...query, staffId: 4, result: 'INVALID' }, ADMIN);
    repo.maxLogId.mockResolvedValue(900); // newer scans arrive while the Admin pages through
    await getLogs({ ...query, page: 3, staffId: 4, result: 'INVALID', snapshotId: first.meta.snapshot.id }, ADMIN);
    expect(repo.logs).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ staffId: 4, result: 'INVALID' }), 500, 20, 40);
    expect(repo.countLogs).toHaveBeenCalledTimes(1);
  });
  it('exports all matching rows rather than only the current page', async () => {
    const view = await getLogs({ ...query, page: 3 }, ADMIN);
    await getLogsForExport({ ...query, page: 3, snapshotId: view.meta.snapshot.id }, ADMIN);
    expect(repo.logs).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 500, 10000, 0);
  });
  it('freezes the export at the viewed watermark even when new scans have arrived', async () => {
    const view = await getLogs(query, ADMIN);
    repo.maxLogId.mockResolvedValue(9999);
    const { data } = await getLogsForExport({ ...query, snapshotId: view.meta.snapshot.id }, ADMIN);
    expect(data.watermark).toBe(500);
    expect(repo.logs).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), 500, 10000, 0);
  });
  it('rejects an export whose filters differ from the viewed snapshot', async () => {
    const view = await getLogs({ ...query, result: 'SUCCESS' }, ADMIN);
    await expect(getLogsForExport({ ...query, result: 'INVALID', snapshotId: view.meta.snapshot.id }, ADMIN)).rejects.toMatchObject({ code: 'SNAPSHOT_FILTER_MISMATCH' });
  });
  it('refuses an oversized export before loading rows', async () => {
    repo.countLogs.mockResolvedValue(10001);
    await expect(getLogsForExport(query, ADMIN)).rejects.toMatchObject({ code: 'EXPORT_TOO_LARGE' });
    expect(repo.logs).not.toHaveBeenCalled();
  });
});

const logSnapshot = (over = {}) => ({
  scope: { type: 'event' as const, eventId: 1, eventName: 'Demo', eventStatus: 'completed' },
  filters: { eventId: 1, from: null, to: null, staffId: 2, result: 'INVALID' }, watermark: 77, total: 1, generatedAt: '2026-10-17T01:00:00.000Z',
  stats: { total: 1, success: 0, rejected: 1, duplicate: 0, invalid: 1 }, ...over,
});
it('keeps invalid scans with a null ticket in the XLSX and includes filters', async () => {
  const buffer = await logsWorkbook(logSnapshot(), [{ id: 1, eventName: '@event', staffId: 2,
    staffName: '=HYPERLINK("bad")', ticketCode: null, result: 'INVALID', scannedCode: '***123', message: 'Mã sai', checkedAt: new Date('2026-09-15T00:00:00Z') } as never]);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('Lịch sử check-in')!;
  expect(sheet.rowCount).toBe(2);
  expect(sheet.getCell('N2').value).toBe('=HYPERLINK("bad")');
  expect(sheet.getCell('N2').type).toBe(ExcelJS.ValueType.String);
  expect(sheet.getCell('E2').value).toBeNull();
  expect((sheet.getCell('A2').value as Date).toISOString()).toBe('2026-09-15T07:00:00.000Z'); // Vietnam wall clock
  const info = JSON.stringify(book.getWorksheet('Tổng quan')!.getSheetValues());
  expect(info).toContain('Demo (Event ID 1)');
  expect(info).toContain('Mã không hợp lệ');
  // The file is frozen at the viewed watermark; it says so in words instead of a Log ID.
  expect(info).toContain('Lượt quét phát sinh sau thời điểm này không có trong file');
});

it('labels an all-Events log export as such, with the capture time rather than the download time', async () => {
  const buffer = await logsWorkbook(logSnapshot({ scope: { type: 'all', eventId: null, eventName: null, eventStatus: null }, filters: { eventId: null, from: '2026-10-01', to: null, staffId: null, result: null } }), []);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const info = JSON.stringify(book.getWorksheet('Tổng quan')!.getSheetValues());
  expect(info).toContain('Tất cả sự kiện');
  expect(info).toContain('Từ 01/10/2026');
  expect(info).toContain('Dữ liệu chụp lúc 17/10/2026 08:00:00'); // generatedAt 01:00 UTC, not the download time
});

it('exports identified Ticket, holder and Order details without exposing a QR credential', async () => {
  const buffer = await logsWorkbook(logSnapshot({ filters: { eventId: 1, from: null, to: null, staffId: null, result: null } }), [{
    id: 2, eventName: 'Concert', staffId: 3, staffName: 'Gate Staff', ticketCode: 'TKT-001',
    ticketStatus: 'checked_in', ticketTypeName: 'VIP', holderName: 'Nguyễn Văn A',
    holderEmail: 'holder@example.com', orderCode: 'ORD-001', buyerName: 'Người mua',
    buyerEmail: 'buyer@example.com', buyerPhone: '0901234567', result: 'SUCCESS',
    scannedCode: '***deadbeef', message: 'Check-in thành công', checkedAt: new Date('2026-09-15T00:00:00Z'),
  } as never]);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('Lịch sử check-in')!;
  expect(sheet.getCell('E2').value).toBe('TKT-001');
  expect(sheet.getCell('F2').value).toBe('VIP');
  expect(sheet.getCell('G2').value).toBe('Đã vào cổng');
  expect(sheet.getCell('H2').value).toBe('Nguyễn Văn A');
  expect(sheet.getCell('J2').value).toBe('ORD-001');
  expect(sheet.getCell('C2').value).toBe('Check-in thành công');
  expect(sheet.getCell('P2').value).toBe('***deadbeef');
  expect(JSON.stringify(sheet.getRow(2).values)).not.toContain('ticketbox:');
});
