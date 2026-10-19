import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { logsWorkbook, reportWorkbook } from '../src/modules/reports/report.export.js';
import { rateBasis, sumCounts, withDerived } from '../src/modules/reports/report.metrics.js';
import type { LogRow } from '../src/modules/reports/report.repository.js';
import type { LogSnapshotData, ReportData } from '../src/modules/reports/report.service.js';

const GENERATED_AT = '2026-10-17T03:15:00.000Z';
const eventRow = (id: number, name: string, status: string, over = {}) => ({
  id, name, status, startTime: new Date('2026-10-01T10:00:00Z'),
  ...withDerived({ confirmedOrders: 2, soldTickets: 4, issuedTickets: 4, admissions: 2, capacity: 10, scans: 5, rejectedScans: 3, grossRevenue: 300_000, refundedAmount: 350_000, ...over }),
});
function sample(periods = ['2026-10-06', '2026-10-07'], overrides: Partial<ReportData> = {}): ReportData {
  const events = [eventRow(7, 'Sự kiện báo cáo', 'cancelled')];
  const totals = sumCounts(events);
  return {
    scope: { type: 'event', eventId: 7, eventName: 'Sự kiện báo cáo', eventStatus: 'cancelled' },
    filters: { eventId: 7, from: null, to: null, groupBy: 'day' }, generatedAt: GENERATED_AT,
    totals, rates: rateBasis(totals), events,
    revenueSeries: [
      { period: periods[0]!, grossRevenue: 100_000, refundedAmount: 0, netRevenue: 100_000 },
      { period: periods[1]!, grossRevenue: 200_000, refundedAmount: 350_000, netRevenue: -150_000 },
    ] as never,
    ...overrides,
  };
}
async function read(data: ReportData) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await reportWorkbook(data));
  return book;
}

const sheetText = (sheet: ExcelJS.Worksheet) => JSON.stringify(sheet.getSheetValues());
/** Row whose first cell equals `label` on the summary sheet. */
function summaryRow(book: ExcelJS.Workbook, label: string) {
  const info = book.getWorksheet('Tổng quan')!;
  let found = 0;
  info.eachRow((row, n) => { if (row.getCell(1).value === label) found = n; });
  expect(found, label).toBeGreaterThan(0);
  return info.getRow(found);
}
const cached = (cell: ExcelJS.Cell) => (typeof cell.value === 'object' && cell.value && 'result' in cell.value ? cell.value.result : cell.value);

describe('Admin Reports Excel content', () => {
  it('opens on a readable summary, then one row per Event, then money per period', async () => {
    const book = await read(sample());
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['Tổng quan', 'Theo sự kiện', 'Doanh thu theo kỳ']);
    const info = sheetText(book.getWorksheet('Tổng quan')!);
    expect(info).toContain('Sự kiện báo cáo (Event ID 7)');
    expect(info).toContain('17/10/2026 10:15:00'); // capture time in Vietnam time, not download time
    expect(info).toContain('không có giao dịch tiền thật'); // simulated money
    expect(info).not.toMatch(/paid_at|completed_at|confirmed_at/); // no column names for the reader
  });

  it('exports every per-Event metric as numeric data with real Excel percentages and dates', async () => {
    const sheet = (await read(sample())).getWorksheet('Theo sự kiện')!;
    expect(sheet.getCell('A2').value).toBe('Sự kiện báo cáo');
    expect((sheet.getCell('B2').value as Date).toISOString()).toBe('2026-10-01T17:00:00.000Z'); // 10:00 UTC shown as 17:00 VN
    expect(sheet.getCell('B2').numFmt).toBe('dd/mm/yyyy');
    expect(sheet.getCell('C2').value).toBe('Đã hủy');
    for (const [column, value] of Object.entries({
      D: 2, E: 4, F: 10, G: 0.4, H: 4, I: 2, J: 0.5, K: 5, L: 3, M: 300_000, N: 350_000, O: -50_000,
    })) {
      expect(sheet.getCell(`${column}2`).value, column).toBe(value);
      expect(sheet.getCell(`${column}2`).type).toBe(ExcelJS.ValueType.Number);
    }
    expect(sheet.getCell('G2').numFmt).toBe('0.0%');
    expect(sheet.getCell('M2').numFmt).toContain('₫');
    expect(sheet.rowCount).toBe(2); // a single Event has no totals row
  });

  it('summary figures equal the server totals, with ratios as formulas over the summary cells', async () => {
    const data = sample();
    const book = await read(data);
    expect(cached(summaryRow(book, 'Đã thu (mô phỏng)').getCell(2))).toBe(data.totals.grossRevenue);
    expect(cached(summaryRow(book, 'Thu ròng (mô phỏng)').getCell(2))).toBe(-50_000);
    const fill = summaryRow(book, 'Tỷ lệ lấp đầy').getCell(2);
    expect((fill.value as ExcelJS.CellFormulaValue).formula).toMatch(/^IF\(B\d+>0,B\d+\/B\d+,0\)$/);
    expect(cached(fill)).toBe(0.4);
    expect(fill.numFmt).toBe('0.0%');
  });

  it.each([
    ['day', 'Ngày', 'Kỳ (ngày)', '2026-10-06', '2026-10-07', ['2026-10-06', '2026-10-07'], 'dd/mm/yyyy', '2026-10-06T00:00:00.000Z'],
    ['month', 'Tháng', 'Kỳ (tháng)', '2026-09-01', '2026-10-31', ['2026-09', '2026-10'], 'mm/yyyy', '2026-09-01T00:00:00.000Z'],
    ['year', 'Năm', 'Kỳ (năm)', '2025-01-01', '2026-12-31', ['2025', '2026'], undefined, undefined],
  ] as const)('preserves the selected %s grouping, dates and Event in the file', async (groupBy, label, header, from, to, periods, numFmt, firstIso) => {
    const book = await read(sample([...periods], { filters: { eventId: 7, from, to, groupBy } }));
    const info = sheetText(book.getWorksheet('Tổng quan')!);
    expect(info).toContain(label);
    expect(info).toContain(`Từ ${from.split('-').reverse().join('/')} đến hết ${to.split('-').reverse().join('/')}`);
    const trend = book.getWorksheet('Doanh thu theo kỳ')!;
    expect(trend.getCell('A1').value).toBe(header);
    const first = trend.getCell('A2');
    if (firstIso) {
      expect((first.value as Date).toISOString()).toBe(firstIso);
      expect(first.numFmt).toBe(numFmt);
    } else {
      expect(first.value).toBe(2025);
    }
    expect(trend.getCell('A4').value).toBe('Tổng cộng');
    expect(trend.getCell('B4').value).toEqual({ formula: 'SUM(B2:B3)', result: 300_000 });
    expect(cached(trend.getCell('D3'))).toBe(-150_000);
    expect(trend.autoFilter).toBe('A1:D3'); // totals row stays outside the filter
  });

  it('exports an empty period as zeros without fabricating revenue rows', async () => {
    const empty = eventRow(7, 'Sự kiện báo cáo', 'cancelled', { confirmedOrders: 0, soldTickets: 0, issuedTickets: 0, admissions: 0, capacity: 0, scans: 0, rejectedScans: 0, grossRevenue: 0, refundedAmount: 0 });
    const totals = sumCounts([empty]);
    const book = await read(sample(undefined, { events: [empty], totals, rates: rateBasis(totals), revenueSeries: [] }));
    const sheet = book.getWorksheet('Theo sự kiện')!;
    for (let column = 4; column <= 15; column++) expect(sheet.getCell(2, column).value).toBe(0);
    expect(book.getWorksheet('Doanh thu theo kỳ')!.rowCount).toBe(1);
    expect(sheetText(book.getWorksheet('Tổng quan')!)).toContain('Toàn bộ thời gian');
  });

  it('preserves period-based attendance above 100% and explains its denominator', async () => {
    const above = eventRow(7, 'Sự kiện báo cáo', 'cancelled', { admissions: 5 });
    const totals = sumCounts([above]);
    const book = await read(sample(undefined, { events: [above], totals, rates: rateBasis(totals) }));
    expect(book.getWorksheet('Theo sự kiện')!.getCell('J2').value).toBe(1.25);
    const text = sheetText(book.getWorksheet('Tổng quan')!);
    expect(text).toContain('tỷ lệ tham dự có thể vượt 100%');
    expect(text).toContain('không phải số người mua duy nhất');
  });

  it('states that the file is the viewed snapshot, not a fresh read at download time', async () => {
    const info = sheetText((await read(sample())).getWorksheet('Tổng quan')!);
    expect(info).toContain('đúng bản dữ liệu chụp đang hiển thị');
    expect(info).toContain('không có giao dịch tiền thật');
  });
});

describe('All Events workbook', () => {
  function allEvents(): ReportData {
    const events = [
      eventRow(1, '=HYPERLINK("x")', 'completed', { soldTickets: 5, capacity: 10, admissions: 5, grossRevenue: 100, refundedAmount: 0 }),
      eventRow(2, 'Còn trống', 'ongoing', { soldTickets: 10, capacity: 1000, admissions: 1, grossRevenue: 200, refundedAmount: 50 }),
      eventRow(3, 'Chưa có hoạt động', 'published', { confirmedOrders: 0, soldTickets: 0, issuedTickets: 0, admissions: 0, scans: 0, rejectedScans: 0, grossRevenue: 0, refundedAmount: 0 }),
    ];
    const totals = sumCounts(events);
    return sample(undefined, {
      scope: { type: 'all', eventId: null, eventName: null, eventStatus: null },
      filters: { eventId: null, from: '2026-10-01', to: null, groupBy: 'month' }, events, totals, rates: rateBasis(totals),
    });
  }

  it('labels the scope and lists every Event, including the one without activity', async () => {
    const book = await read(allEvents());
    const info = sheetText(book.getWorksheet('Tổng quan')!);
    expect(info).toContain('Tất cả sự kiện');
    expect(info).toContain('Từ 01/10/2026');
    expect(info).toContain('Bản nháp chưa từng mở bán nên không tính');
    const sheet = book.getWorksheet('Theo sự kiện')!;
    expect(sheet.getCell('A4').value).toBe('Chưa có hoạt động');
    expect(sheet.getCell('A2').value).toBe('=HYPERLINK("x")'); // text, never a formula
    expect(sheet.getCell('A2').type).toBe(ExcelJS.ValueType.String);
  });

  it('builds the totals row from formulas over the rows, with the server value cached', async () => {
    const data = allEvents();
    const sheet = (await read(data)).getWorksheet('Theo sự kiện')!;
    const total = 5;
    expect(sheet.getCell(`A${total}`).value).toBe('Tổng cộng (3 sự kiện)');
    expect(sheet.getCell(`E${total}`).value).toEqual({ formula: 'SUM(E2:E4)', result: 15 });
    expect(sheet.getCell(`F${total}`).value).toEqual({ formula: 'SUM(F2:F4)', result: 1020 });
    // Ratio of totals (15 / 1020), not the mean of the per-Event percentages.
    expect(sheet.getCell(`G${total}`).value).toEqual({ formula: `IF(F${total}>0,E${total}/F${total},0)`, result: data.totals.fillRate / 100 });
    expect(data.totals.fillRate).toBeCloseTo(1.47, 2);
    expect(sheet.getCell(`J${total}`).value).toEqual({ formula: `IF(E${total}>0,I${total}/E${total},0)`, result: data.totals.attendanceRate / 100 });
    expect(sheet.getCell(`O${total}`).value).toEqual({ formula: `M${total}-N${total}`, result: 250 });
  });

  it('keeps the autofilter on the Event rows so sorting cannot move the totals row', async () => {
    const sheet = (await read(allEvents())).getWorksheet('Theo sự kiện')!;
    expect(sheet.autoFilter).toBe('A1:O4'); // header + 3 Event rows; the totals row 5 stays outside
  });
});

describe('report metrics', () => {
  it('returns 0% for a zero denominator instead of NaN or Infinity', () => {
    expect(withDerived({ confirmedOrders: 0, soldTickets: 0, issuedTickets: 0, admissions: 3, scans: 0, rejectedScans: 0, capacity: 0, grossRevenue: 0, refundedAmount: 0 }))
      .toMatchObject({ fillRate: 0, attendanceRate: 0, netRevenue: 0 });
  });
  it('sums no Events to all zeros', () => {
    expect(sumCounts([])).toMatchObject({ soldTickets: 0, capacity: 0, fillRate: 0, netRevenue: 0 });
  });
  it('avoids floating-point drift when adding money', () => {
    const rows = [0.1, 0.2].map((grossRevenue) => ({ ...withDerived({ confirmedOrders: 0, soldTickets: 0, issuedTickets: 0, admissions: 0, scans: 0, rejectedScans: 0, capacity: 0, grossRevenue, refundedAmount: 0 }) }));
    expect(sumCounts(rows).grossRevenue).toBe(0.3);
  });
});

describe('Check-in logs workbook', () => {
  const log = (id: number, over: Partial<LogRow> = {}) => ({
    id, eventId: 1, eventName: 'Đêm nhạc A', staffId: 5, staffName: 'Nguyễn Văn An', ticketCode: `TB-${id}`,
    ticketStatus: 'checked_in', ticketTypeName: 'VIP', holderName: 'Khách', holderEmail: 'khach@example.com',
    orderCode: 'ORD-1', buyerName: 'Người mua', buyerEmail: 'mua@example.com', buyerPhone: '0901234567',
    result: 'SUCCESS', scannedCode: '***abcd1234', message: 'Check-in thành công.',
    checkedAt: new Date('2026-10-17T12:30:05Z'), ...over,
  }) as LogRow;
  const rows = [
    log(4, { result: 'INVALID', ticketCode: null, ticketStatus: null, ticketTypeName: null, holderName: null, holderEmail: null, orderCode: null, buyerName: null, buyerEmail: null, buyerPhone: null, message: 'Mã vé không hợp lệ.', checkedAt: new Date('2026-10-17T12:40:00Z') }),
    log(3, { result: 'ALREADY_CHECKED_IN', ticketCode: 'TB-1', message: 'Vé đã được check-in trước đó.', checkedAt: new Date('2026-10-17T12:35:00Z') }),
    log(2, { eventId: 2, eventName: '=HYPERLINK("x")', staffId: 6, staffName: 'Trần Bình', ticketStatus: 'issued', checkedAt: new Date('2026-10-17T11:00:00Z') }),
    log(1),
  ];
  const snapshot = (over: Partial<LogSnapshotData> = {}): LogSnapshotData => ({
    scope: { type: 'all', eventId: null, eventName: null, eventStatus: null },
    filters: { eventId: null, from: '2026-10-17', to: '2026-10-17', staffId: null, result: null },
    watermark: 4, total: rows.length, stats: { total: 4, success: 2, rejected: 2, duplicate: 1, invalid: 1 },
    generatedAt: GENERATED_AT, ...over,
  });
  async function open(data: LogSnapshotData, logs: LogRow[] = rows) {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await logsWorkbook(data, logs));
    return book;
  }
  const values = (sheet: ExcelJS.Worksheet) => JSON.stringify(sheet.getSheetValues());

  it('opens on a readable summary, then the scans, then totals per Event and per Staff', async () => {
    const book = await open(snapshot());
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['Tổng quan', 'Lịch sử check-in', 'Theo sự kiện', 'Theo nhân viên']);
    const info = values(book.getWorksheet('Tổng quan')!);
    expect(info).toContain('Tất cả sự kiện');
    expect(info).toContain('Ngày 17/10/2026');
    expect(info).toContain('17/10/2026 10:15:00'); // generatedAt in Vietnam time
    expect(info).not.toMatch(/Log ID|watermark|paid_at/);
  });

  it('counts every result from the exported rows, with the ratio as a real percentage', async () => {
    const info = (await open(snapshot())).getWorksheet('Tổng quan')!;
    const find = (label: string) => { let found = 0; info.eachRow((row, n) => { if (row.getCell(1).value === label) found = n; }); return info.getRow(found); };
    expect(find('Vào cổng thành công').getCell(2).value).toBe(2);
    expect(find('Vé đã được sử dụng').getCell(2).value).toBe(1);
    expect(find('Mã không hợp lệ').getCell(2).value).toBe(1);
    expect(find('Vé đã bị hủy').getCell(2).value).toBe(0);
    expect((find('Tổng cộng').getCell(2).value as ExcelJS.CellFormulaValue).result).toBe(4);
    expect((find('Trong đó bị từ chối').getCell(2).value as ExcelJS.CellFormulaValue).result).toBe(2);
    const rate = find('Vào cổng thành công').getCell(3);
    expect((rate.value as ExcelJS.CellFormulaValue).result).toBe(0.5);
    expect(rate.numFmt).toBe('0.0%');
  });

  it('writes each scan with Vietnamese labels, a sortable Vietnam-time date and text kept as text', async () => {
    const sheet = (await open(snapshot())).getWorksheet('Lịch sử check-in')!;
    expect(sheet.rowCount - 1).toBe(rows.length);
    expect(sheet.getCell('A1').value).toBe('Thời điểm quét');
    const time = sheet.getCell('A5');
    expect(time.type).toBe(ExcelJS.ValueType.Date);
    expect((time.value as Date).toISOString()).toBe('2026-10-17T19:30:05.000Z'); // 12:30:05 UTC reads 19:30:05
    expect(time.numFmt).toBe('dd/mm/yyyy hh:mm:ss');
    expect(sheet.getCell('B2').value).toBe('Mã không hợp lệ');
    expect(sheet.getCell('B3').value).toBe('Vé đã được sử dụng');
    expect(sheet.getCell('G4').value).toBe('Chưa vào cổng');
    expect(sheet.getCell('G5').value).toBe('Đã vào cổng');
    expect(sheet.getCell('D4').value).toBe('=HYPERLINK("x")');
    expect(sheet.getCell('D4').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('M5').value).toBe('0901234567'); // leading zero kept
    expect(values(sheet)).not.toMatch(/"(SUCCESS|INVALID|ALREADY_CHECKED_IN|issued|checked_in)"/);
    expect(sheet.autoFilter).toBe('A1:Q5');
  });

  it('totals per Event and per Staff agree with the rows, totals row outside the filter', async () => {
    const book = await open(snapshot());
    const events = book.getWorksheet('Theo sự kiện')!;
    expect(events.getCell('A2').value).toBe('Đêm nhạc A');
    expect([events.getCell('B2').value, events.getCell('C2').value, events.getCell('D2').value, events.getCell('E2').value]).toEqual([3, 1, 2, 1]);
    expect(events.getCell('A4').value).toBe('Tổng cộng');
    expect(events.getCell('B4').value).toEqual({ formula: 'SUM(B2:B3)', result: 4 });
    expect(events.autoFilter).toBe('A1:H3');
    const staff = book.getWorksheet('Theo nhân viên')!;
    expect([staff.getCell('A2').value, staff.getCell('B2').value, staff.getCell('C2').value, staff.getCell('G2').value]).toEqual(['Nguyễn Văn An', 5, 3, 1]);
    expect((staff.getCell('F2').value as ExcelJS.CellFormulaValue).result).toBeCloseTo(1 / 3);
  });

  it('names the selected Event, Staff and result; single-Event files skip the per-Event sheet', async () => {
    const one = rows.filter((row) => row.eventId === 1 && row.staffId === 5 && row.result === 'SUCCESS');
    const book = await open(snapshot({
      scope: { type: 'event', eventId: 1, eventName: 'Đêm nhạc A', eventStatus: 'ongoing' },
      filters: { eventId: 1, from: null, to: null, staffId: 5, result: 'SUCCESS' }, total: one.length,
    }), one);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['Tổng quan', 'Lịch sử check-in', 'Theo nhân viên']);
    const info = values(book.getWorksheet('Tổng quan')!);
    expect(info).toContain('Đêm nhạc A (Event ID 1)');
    expect(info).toContain('Nguyễn Văn An');
    expect(info).toContain('Toàn bộ thời gian');
  });

  it('exports an empty view as headers and zeros, never invented rows', async () => {
    const book = await open(snapshot({ total: 0, stats: { total: 0, success: 0, rejected: 0, duplicate: 0, invalid: 0 } }), []);
    expect(book.getWorksheet('Lịch sử check-in')!.rowCount).toBe(1);
    expect(book.getWorksheet('Theo nhân viên')!.rowCount).toBe(1);
  });
});
