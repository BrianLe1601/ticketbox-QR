import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { reportWorkbook } from '../src/modules/reports/report.export.js';
import type { ReportRow } from '../src/modules/reports/report.repository.js';
import type { ReportQuery } from '../src/modules/reports/report.schema.js';

function sample(periods = ['2026-10-06', '2026-10-07']): ReportRow {
  return {
    id: 7, name: 'Sự kiện báo cáo', status: 'cancelled', confirmedOrders: 2,
    soldTickets: 4, issuedTickets: 4, admissions: 2, capacity: 10,
    fillRate: 40, attendanceRate: 50, scans: 5, rejectedScans: 3,
    grossRevenue: 300_000, refundedAmount: 350_000, netRevenue: -50_000,
    revenueSeries: [
      { period: periods[0]!, grossRevenue: 100_000, refundedAmount: 0, netRevenue: 100_000 },
      { period: periods[1]!, grossRevenue: 200_000, refundedAmount: 350_000, netRevenue: -150_000 },
    ],
  } as ReportRow;
}
async function read(query: ReportQuery, report = sample()) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await reportWorkbook(query, report));
  return book;
}

describe('Admin Reports Excel content', () => {
  it('exports every summary metric as numeric data with real Excel percentages', async () => {
    const report = sample();
    const book = await read({ eventId: 7, groupBy: 'day' }, report);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['Bộ lọc', 'Báo cáo sự kiện', 'Doanh thu theo kỳ']);
    const sheet = book.getWorksheet('Báo cáo sự kiện')!;
    expect(sheet.getCell('A2').value).toBe(report.name);
    expect(sheet.getCell('B2').value).toBe('Đã hủy');
    for (const [column, value] of Object.entries({
      C: 2, D: 4, E: 10, F: 0.4, G: 4, H: 2, I: 0.5,
      J: 5, K: 3, L: 300_000, M: 350_000, N: -50_000,
    })) {
      expect(sheet.getCell(`${column}2`).value).toBe(value);
      expect(sheet.getCell(`${column}2`).type).toBe(ExcelJS.ValueType.Number);
    }
    expect(sheet.getCell('F2').numFmt).toBe('0.00%');
    expect(sheet.getCell('I2').numFmt).toBe('0.00%');
    for (const [column, key] of [['B', 'grossRevenue'], ['C', 'refundedAmount'], ['D', 'netRevenue']] as const) {
      const trend = book.getWorksheet('Doanh thu theo kỳ')!;
      const total = Number(trend.getCell(`${column}2`).value) + Number(trend.getCell(`${column}3`).value);
      expect(total).toBe(report[key]);
    }
  });

  it.each([
    ['day', 'Ngày', 'Kỳ (ngày)', '2026-10-06', '2026-10-07', ['2026-10-06', '2026-10-07']],
    ['month', 'Tháng', 'Kỳ (tháng)', '2026-09-01', '2026-10-31', ['2026-09', '2026-10']],
    ['year', 'Năm', 'Kỳ (năm)', '2025-01-01', '2026-12-31', ['2025', '2026']],
  ] as const)('preserves the selected %s grouping, dates and Event in the file', async (groupBy, label, header, from, to, periods) => {
    const book = await read({ eventId: 7, from, to, groupBy }, sample([...periods]));
    const info = book.getWorksheet('Bộ lọc')!;
    expect(info.getCell('B2').value).toBe(7);
    expect(info.getCell('B3').value).toBe(from);
    expect(info.getCell('B4').value).toBe(to);
    expect(info.getCell('B5').value).toBe(label);
    expect(info.getCell('B6').value).toContain('UTC+07:00');
    expect(info.getCell('B10').value).toBe('Sự kiện báo cáo');
    const trend = book.getWorksheet('Doanh thu theo kỳ')!;
    expect(trend.getCell('A1').value).toBe(header);
    expect(trend.getCell('A2').value).toBe(periods[0]);
    expect(trend.getCell('A3').value).toBe(periods[1]);
  });

  it('exports an empty period as zeros without fabricating revenue rows', async () => {
    const report = sample();
    for (const key of ['confirmedOrders', 'soldTickets', 'issuedTickets', 'admissions', 'capacity', 'fillRate', 'attendanceRate', 'scans', 'rejectedScans', 'grossRevenue', 'refundedAmount', 'netRevenue'] as const) report[key] = 0;
    report.revenueSeries = [];
    const book = await read({ eventId: 7, groupBy: 'day' }, report);
    const sheet = book.getWorksheet('Báo cáo sự kiện')!;
    for (let column = 3; column <= 14; column++) expect(sheet.getCell(2, column).value).toBe(0);
    expect(book.getWorksheet('Doanh thu theo kỳ')!.rowCount).toBe(1);
    expect(book.getWorksheet('Bộ lọc')!.getCell('B3').value).toBe('Không giới hạn');
  });

  it('preserves period-based attendance above 100% and explains its denominator', async () => {
    const report = sample(); report.admissions = 5; report.attendanceRate = 125;
    const book = await read({ eventId: 7, groupBy: 'day' }, report);
    expect(book.getWorksheet('Báo cáo sự kiện')!.getCell('I2').value).toBe(1.25);
    const text = JSON.stringify(book.getWorksheet('Bộ lọc')!.getSheetValues());
    expect(text).toContain('tỷ lệ tham dự có thể vượt 100%');
    expect(text).toContain('không phải số người mua duy nhất');
    expect(text).toContain('File lấy dữ liệu mới tại lúc xuất');
  });
});
