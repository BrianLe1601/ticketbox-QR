import ExcelJS from 'exceljs';
import type { LogRow } from './report.repository.js';
import { ALL_EVENTS_LABEL, type LogSnapshotData, type ReportData } from './report.service.js';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp', published: 'Đã công bố', ongoing: 'Đang diễn ra',
  completed: 'Đã kết thúc', cancelled: 'Đã hủy',
};
const scopeLabel = (scope: { type: 'all' | 'event'; eventId: number | null; eventName: string | null }) =>
  scope.type === 'event' ? `${scope.eventName} (Event ID ${scope.eventId})` : ALL_EVENTS_LABEL;

// ---------------------------------------------------------------- Check-in logs workbook

/** Same wording as the Admin page (client lib/admin-checkin-logs.ts). */
export const RESULT_LABELS: Record<string, string> = {
  SUCCESS: 'Vào cổng thành công', FAILED: 'Tất cả lượt bị từ chối',
  ALREADY_CHECKED_IN: 'Vé đã được sử dụng', WRONG_EVENT: 'Vé của sự kiện khác',
  CANCELLED: 'Vé đã bị hủy', UNPAID: 'Đơn chưa thanh toán', INVALID: 'Mã không hợp lệ',
  EVENT_NOT_AVAILABLE: 'Ngoài giờ check-in', STAFF_NOT_ASSIGNED: 'Nhân viên chưa được phân công',
};
const RESULT_ORDER = ['SUCCESS', 'ALREADY_CHECKED_IN', 'WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'EVENT_NOT_AVAILABLE', 'STAFF_NOT_ASSIGNED'];
const TICKET_LABELS: Record<string, string> = { issued: 'Chưa vào cổng', checked_in: 'Đã vào cổng', cancelled: 'Đã hủy' };
const BRAND = 'FF287A64';
const HEADER_FILL = 'FFE6F2EE';
const RESULT_FILL: Record<string, string> = { ok: 'FFE4F5EE', warn: 'FFFFF3DC', bad: 'FFFDECEE' };
const resultTone = (code: string) => code === 'SUCCESS' ? 'ok' : code === 'ALREADY_CHECKED_IN' || code === 'EVENT_NOT_AVAILABLE' ? 'warn' : 'bad';
const DATE_TIME = 'dd/mm/yyyy hh:mm:ss';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Excel has no time zones: write the Vietnam wall-clock time so the cell reads like the screen. */
const vnCell = (value: Date | string) => new Date(new Date(value).getTime() + VN_OFFSET_MS);
const vnDisplay = (value: Date | string) => {
  const d = vnCell(value);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}`;
};
const vnDate = (day: string) => day.split('-').reverse().join('/');
function rangeText(from: string | null, to: string | null) {
  if (!from && !to) return 'Toàn bộ thời gian';
  if (from && to) return from === to ? `Ngày ${vnDate(from)}` : `Từ ${vnDate(from)} đến hết ${vnDate(to)}`;
  return from ? `Từ ${vnDate(from)}` : `Đến hết ${vnDate(to!)}`;
}

function headerRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 30;
  row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }; });
}
function section(sheet: ExcelJS.Worksheet, title: string) {
  const row = sheet.addRow([title]);
  row.font = { bold: true, size: 12, color: { argb: BRAND } };
  row.height = 22;
  return row;
}

interface Tally { scans: number; success: number; rejected: number; tickets: Set<number | string>; events: Set<number>; first: Date | null; last: Date | null }
const tally = (): Tally => ({ scans: 0, success: 0, rejected: 0, tickets: new Set(), events: new Set(), first: null, last: null });
function add(t: Tally, log: LogRow) {
  t.scans += 1;
  if (log.result === 'SUCCESS') { t.success += 1; if (log.ticketCode) t.tickets.add(log.ticketCode); } else t.rejected += 1;
  t.events.add(Number(log.eventId));
  const at = new Date(log.checkedAt);
  if (!t.first || at < t.first) t.first = at;
  if (!t.last || at > t.last) t.last = at;
}

/** A grouped sheet (by Event / by Staff) with a SUM totals row kept outside the autofilter. */
function groupSheet(book: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[], rows: Array<Record<string, unknown>>, sums: string[]) {
  const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns;
  headerRow(sheet.getRow(1));
  for (const row of rows) {
    const added = sheet.addRow({ ...row, first: row.first ? vnCell(row.first as Date) : null, last: row.last ? vnCell(row.last as Date) : null });
    added.getCell('rate').value = { formula: `IF(${col(sheet, 'scans')}${added.number}>0,${col(sheet, 'success')}${added.number}/${col(sheet, 'scans')}${added.number},0)`, result: Number(row.scans) > 0 ? Number(row.success) / Number(row.scans) : 0 };
  }
  const last = sheet.rowCount;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, last), column: sheet.columnCount } };
  if (rows.length > 0) {
    const total = sheet.addRow({});
    total.getCell(1).value = 'Tổng cộng';
    for (const key of sums) {
      const letter = col(sheet, key);
      const result = rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
      total.getCell(key).value = { formula: `SUM(${letter}2:${letter}${last})`, result };
    }
    const s = col(sheet, 'success'); const n = col(sheet, 'scans');
    const success = rows.reduce((sum, row) => sum + Number(row.success), 0);
    const scans = rows.reduce((sum, row) => sum + Number(row.scans), 0);
    total.getCell('rate').value = { formula: `IF(${n}${total.number}>0,${s}${total.number}/${n}${total.number},0)`, result: scans > 0 ? success / scans : 0 };
    total.font = { bold: true };
    total.eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: { argb: BRAND } } }; });
  }
  sheet.getColumn('rate').numFmt = '0.0%';
  for (const key of ['first', 'last']) sheet.getColumn(key).numFmt = DATE_TIME;
  return sheet;
}
const col = (sheet: ExcelJS.Worksheet, key: string) => sheet.getColumn(key).letter;

/**
 * Check-in log file, written for the person who opens it: a summary sheet first (scope, result
 * counts, how to read the file), then every scan with Vietnamese labels and real date cells, then
 * totals per Event and per Staff member. Every figure is computed from the exported rows of the
 * viewed snapshot, so the sheets always agree with each other and with the screen.
 */
export async function logsWorkbook(data: LogSnapshotData, logs: LogRow[]) {
  const book = new ExcelJS.Workbook();
  book.creator = 'TicketBox QR';
  book.created = new Date(data.generatedAt);
  // Cached formula results of 0 are not stored by ExcelJS: let Excel recompute on open.
  book.calcProperties.fullCalcOnLoad = true;
  const { filters } = data;
  const staffName = filters.staffId ? logs.find((log) => Number(log.staffId) === filters.staffId)?.staffName : null;
  const counts = new Map<string, number>(RESULT_ORDER.map((code) => [code, 0]));
  for (const log of logs) counts.set(log.result, (counts.get(log.result) ?? 0) + 1);

  // ---- Tổng quan
  const info = book.addWorksheet('Tổng quan', { properties: { tabColor: { argb: BRAND } } });
  info.columns = [{ key: 'a', width: 40 }, { key: 'b', width: 18 }, { key: 'c', width: 14 }, { key: 'd', width: 48 }];
  info.addRow(['Nhật ký check-in · TicketBox QR']).font = { bold: true, size: 16, color: { argb: BRAND } };
  info.mergeCells('A1:D1');
  const sub = info.addRow([`Dữ liệu chụp lúc ${vnDisplay(data.generatedAt)} (giờ Việt Nam). Lượt quét phát sinh sau thời điểm này không có trong file.`]);
  sub.font = { italic: true, color: { argb: 'FF4B5563' } };
  info.mergeCells(`A${sub.number}:D${sub.number}`);
  info.addRow([]);

  section(info, 'Phạm vi đang xem');
  const scopeRows: Array<[string, string | number]> = [
    ['Sự kiện', scopeLabel(data.scope)],
    ['Thời gian', rangeText(filters.from, filters.to)],
    ['Nhân viên quét', filters.staffId ? (staffName ?? `Mã nhân viên ${filters.staffId}`) : 'Tất cả nhân viên'],
    ['Kết quả', filters.result ? RESULT_LABELS[filters.result] ?? filters.result : 'Tất cả kết quả'],
    ['Số lượt quét trong file', logs.length],
  ];
  for (const [label, value] of scopeRows) {
    const row = info.addRow([label, value]);
    row.getCell(1).font = { color: { argb: 'FF4B5563' } };
    row.getCell(2).font = { bold: true };
    info.mergeCells(`B${row.number}:D${row.number}`);
    row.getCell(2).alignment = { horizontal: 'left' };
  }
  info.addRow([]);

  section(info, 'Kết quả quét');
  headerRow(info.addRow(['Kết quả', 'Số lượt', 'Tỷ lệ', 'Ý nghĩa']));
  const firstResult = info.rowCount + 1;
  const lastResult = firstResult + RESULT_ORDER.length - 1;
  const totalRow = lastResult + 1;
  const meaning: Record<string, string> = {
    SUCCESS: 'Vé hợp lệ, khách được vào cổng.',
    ALREADY_CHECKED_IN: 'Vé đã vào cổng trước đó; lượt quét lại bị từ chối.',
    WRONG_EVENT: 'Vé thuộc một sự kiện khác.',
    CANCELLED: 'Vé đã bị hủy (ví dụ sự kiện bị hủy).',
    UNPAID: 'Đơn hàng chưa được xác nhận thanh toán.',
    INVALID: 'Mã không khớp vé nào (mã giả hoặc hỏng).',
    EVENT_NOT_AVAILABLE: 'Quét ngoài khung giờ check-in của sự kiện.',
    STAFF_NOT_ASSIGNED: 'Nhân viên chưa được phân công hoặc đã bị thu hồi quyền.',
  };
  for (const code of RESULT_ORDER) {
    const count = counts.get(code) ?? 0;
    const row = info.addRow([RESULT_LABELS[code], count, null, meaning[code]]);
    row.getCell(3).value = { formula: `IF(B${totalRow}>0,B${row.number}/B${totalRow},0)`, result: logs.length ? count / logs.length : 0 };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RESULT_FILL[resultTone(code)]! } };
    row.getCell(4).font = { color: { argb: 'FF4B5563' } };
  }
  const total = info.addRow(['Tổng cộng', { formula: `SUM(B${firstResult}:B${lastResult})`, result: logs.length }, { formula: `IF(B${totalRow}>0,1,0)`, result: logs.length ? 1 : 0 }]);
  total.font = { bold: true };
  const rejected = info.addRow(['Trong đó bị từ chối', { formula: `B${totalRow}-B${firstResult}`, result: logs.length - (counts.get('SUCCESS') ?? 0) },
    { formula: `IF(B${totalRow}>0,B${totalRow + 1}/B${totalRow},0)`, result: logs.length ? (logs.length - (counts.get('SUCCESS') ?? 0)) / logs.length : 0 }]);
  rejected.font = { italic: true };
  for (let r = firstResult; r <= totalRow + 1; r++) { info.getCell(`B${r}`).numFmt = '#,##0'; info.getCell(`C${r}`).numFmt = '0.0%'; }
  info.addRow([]);

  section(info, 'Cách đọc file');
  const notes = [
    '• Sheet "Lịch sử check-in": mỗi dòng là một lần quét, mới nhất ở trên. Bấm mũi tên ở dòng tiêu đề để lọc theo sự kiện, nhân viên hoặc kết quả.',
    ...(data.scope.type === 'all' ? ['• Sheet "Theo sự kiện": số lượt quét, lượt thành công và số vé đã vào cổng của từng sự kiện.'] : []),
    '• Sheet "Theo nhân viên": mỗi nhân viên đã quét bao nhiêu lượt, ở bao nhiêu sự kiện.',
    '• "Vé đã vào cổng" đếm số vé khác nhau có lượt thành công; một vé bị quét lại được ghi là "Vé đã được sử dụng".',
    '• "Trạng thái vé hiện tại" là trạng thái vé tại lúc chụp dữ liệu, không phải tại lúc quét.',
    '• File không chứa mã QR gốc hay mã băm; "Mã đã che" chỉ là dấu nhận diện rút gọn để đối chiếu.',
  ];
  for (const note of notes) {
    const row = info.addRow([note]);
    info.mergeCells(`A${row.number}:D${row.number}`);
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = 30;
  }
  info.views = [{ showGridLines: false }];

  // ---- Lịch sử check-in (header on row 1: one data row per scan)
  const sheet = book.addWorksheet('Lịch sử check-in', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  sheet.columns = [
    { header: 'Thời điểm quét', key: 'time', width: 21 },
    { header: 'Kết quả', key: 'result', width: 28 },
    { header: 'Chi tiết', key: 'message', width: 44 },
    { header: 'Sự kiện', key: 'eventName', width: 38 },
    { header: 'Mã vé', key: 'ticketCode', width: 22 },
    { header: 'Hạng vé', key: 'ticketTypeName', width: 20 },
    { header: 'Trạng thái vé hiện tại', key: 'ticketStatus', width: 20 },
    { header: 'Người giữ vé', key: 'holderName', width: 24 },
    { header: 'Email người giữ vé', key: 'holderEmail', width: 30 },
    { header: 'Mã đơn hàng', key: 'orderCode', width: 20 },
    { header: 'Người mua', key: 'buyerName', width: 24 },
    { header: 'Email người mua', key: 'buyerEmail', width: 30 },
    { header: 'Số điện thoại', key: 'buyerPhone', width: 15 },
    { header: 'Nhân viên quét', key: 'staffName', width: 24 },
    { header: 'Mã nhân viên', key: 'staffId', width: 13 },
    { header: 'Mã đã che', key: 'scannedCode', width: 16 },
    { header: 'Mã nhật ký', key: 'id', width: 12 },
  ];
  headerRow(sheet.getRow(1));
  // Strings are explicit cell values, never formula objects, even when starting '='.
  for (const log of logs) {
    const row = sheet.addRow({
      // Missing values stay truly empty cells (Excel filters list them as "(Blanks)").
      time: vnCell(log.checkedAt), result: RESULT_LABELS[log.result] ?? log.result, message: log.message ?? null,
      eventName: log.eventName, ticketCode: log.ticketCode ?? null, ticketTypeName: log.ticketTypeName ?? null,
      ticketStatus: log.ticketStatus ? TICKET_LABELS[log.ticketStatus] ?? log.ticketStatus : null,
      holderName: log.holderName ?? null, holderEmail: log.holderEmail ?? null, orderCode: log.orderCode ?? null,
      buyerName: log.buyerName ?? null, buyerEmail: log.buyerEmail ?? null, buyerPhone: log.buyerPhone ?? null,
      staffName: log.staffName, staffId: Number(log.staffId), scannedCode: log.scannedCode ?? null, id: Number(log.id),
    });
    row.getCell('result').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RESULT_FILL[resultTone(log.result)]! } };
  }
  sheet.getColumn('time').numFmt = DATE_TIME;
  sheet.getColumn('time').alignment = { horizontal: 'left' };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };

  // ---- Theo sự kiện / Theo nhân viên
  const byEvent = new Map<number, Tally & { name: string }>();
  const byStaff = new Map<number, Tally & { name: string }>();
  for (const log of logs) {
    const e = byEvent.get(Number(log.eventId)) ?? { ...tally(), name: log.eventName };
    add(e, log); byEvent.set(Number(log.eventId), e);
    const s = byStaff.get(Number(log.staffId)) ?? { ...tally(), name: log.staffName };
    add(s, log); byStaff.set(Number(log.staffId), s);
  }
  const busiest = <T extends Tally>(a: T, b: T) => b.scans - a.scans;
  if (data.scope.type === 'all') {
    groupSheet(book, 'Theo sự kiện', [
      { header: 'Sự kiện', key: 'name', width: 40 }, { header: 'Lượt quét', key: 'scans', width: 12 },
      { header: 'Vào cổng thành công', key: 'success', width: 14 }, { header: 'Bị từ chối', key: 'rejected', width: 12 },
      { header: 'Vé đã vào cổng', key: 'tickets', width: 14 }, { header: 'Tỷ lệ thành công', key: 'rate', width: 14 },
      { header: 'Lượt quét đầu tiên', key: 'first', width: 21 }, { header: 'Lượt quét cuối cùng', key: 'last', width: 21 },
    ], [...byEvent.values()].sort(busiest).map((t) => ({ name: t.name, scans: t.scans, success: t.success, rejected: t.rejected, tickets: t.tickets.size, first: t.first, last: t.last })),
    ['scans', 'success', 'rejected', 'tickets']);
  }
  groupSheet(book, 'Theo nhân viên', [
    { header: 'Nhân viên', key: 'name', width: 28 }, { header: 'Mã nhân viên', key: 'id', width: 13 },
    { header: 'Lượt quét', key: 'scans', width: 12 }, { header: 'Vào cổng thành công', key: 'success', width: 14 },
    { header: 'Bị từ chối', key: 'rejected', width: 12 }, { header: 'Tỷ lệ thành công', key: 'rate', width: 14 },
    { header: 'Số sự kiện', key: 'events', width: 12 },
    { header: 'Lượt quét đầu tiên', key: 'first', width: 21 }, { header: 'Lượt quét cuối cùng', key: 'last', width: 21 },
  ], [...byStaff.entries()].sort(([, a], [, b]) => busiest(a, b)).map(([id, t]) => ({ name: t.name, id, scans: t.scans, success: t.success, rejected: t.rejected, events: t.events.size, first: t.first, last: t.last })),
  ['scans', 'success', 'rejected']);

  return book.xlsx.writeBuffer();
}

// ---------------------------------------------------------------- Report workbook

const MONEY = '#,##0" ₫";[Red]-#,##0" ₫"';
const COUNT = '#,##0';
const PERCENT = '0.0%';
/** API percent (40.5) → Excel fraction (0.405) without floating-point tails. */
const fraction = (percent: number) => Math.round(Number(percent) * 100) / 10000;
const GROUP_LABELS = { day: 'Ngày', month: 'Tháng', year: 'Năm' } as const;

/** A real, sortable period cell: a date for days/months, the year as a number. */
function periodCell(period: string, groupBy: 'day' | 'month' | 'year'): { value: Date | number; numFmt?: string } {
  const [year = 0, month, day] = period.split('-').map(Number);
  if (groupBy === 'year' || !month) return { value: year };
  if (groupBy === 'month' || !day) return { value: new Date(Date.UTC(year, month - 1, 1)), numFmt: 'mm/yyyy' };
  return { value: new Date(Date.UTC(year, month - 1, day)), numFmt: 'dd/mm/yyyy' };
}

/**
 * Report file written for the person who opens it: "Tổng quan" first (scope, the key figures with
 * how each one is computed, how to read the file), then one row per Event, then money per period.
 * Ratios in totals are formulas over summed cells (never an average of percentages) with the
 * server value cached; `fullCalcOnLoad` lets Excel refresh them on open. Money is simulated.
 */
export async function reportWorkbook(data: ReportData) {
  const book = new ExcelJS.Workbook();
  book.creator = 'TicketBox QR';
  book.created = new Date(data.generatedAt);
  book.calcProperties.fullCalcOnLoad = true;
  const { totals, filters } = data;
  const all = data.scope.type === 'all';

  // ---- Tổng quan
  const info = book.addWorksheet('Tổng quan', { properties: { tabColor: { argb: BRAND } }, views: [{ showGridLines: false }] });
  info.columns = [{ key: 'a', width: 34 }, { key: 'b', width: 22 }, { key: 'c', width: 70 }];
  info.addRow(['Báo cáo · TicketBox QR']).font = { bold: true, size: 16, color: { argb: BRAND } };
  info.mergeCells('A1:C1');
  const sub = info.addRow([`Dữ liệu chụp lúc ${vnDisplay(data.generatedAt)} (giờ Việt Nam). Tiền là dữ liệu mô phỏng, không có giao dịch tiền thật.`]);
  sub.font = { italic: true, color: { argb: 'FF4B5563' } };
  info.mergeCells(`A${sub.number}:C${sub.number}`);
  info.addRow([]);

  section(info, 'Phạm vi đang xem');
  const scopeRows: Array<[string, string | number]> = [
    ['Sự kiện', scopeLabel(data.scope)],
    ['Thời gian', rangeText(filters.from, filters.to)],
    ['Doanh thu nhóm theo', GROUP_LABELS[filters.groupBy]],
    ['Số sự kiện trong báo cáo', data.events.length],
  ];
  for (const [label, value] of scopeRows) {
    const row = info.addRow([label, value]);
    row.getCell(1).font = { color: { argb: 'FF4B5563' } };
    row.getCell(2).font = { bold: true };
    row.getCell(2).alignment = { horizontal: 'left' };
    info.mergeCells(`B${row.number}:C${row.number}`);
  }
  info.addRow([]);

  section(info, 'Chỉ số chính');
  headerRow(info.addRow(['Chỉ số', 'Giá trị', 'Cách tính']));
  const at: Record<string, number> = {};
  const metric = (key: string, label: string, value: ExcelJS.CellValue, numFmt: string, how: string) => {
    const row = info.addRow([label, value, how]);
    at[key] = row.number;
    row.getCell(2).numFmt = numFmt;
    row.getCell(2).font = { bold: true };
    row.getCell(3).font = { color: { argb: 'FF4B5563' } };
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
  };
  metric('gross', 'Đã thu (mô phỏng)', totals.grossRevenue, MONEY, 'Tổng thanh toán mô phỏng thành công, tính theo ngày thanh toán.');
  metric('refund', 'Đã hoàn (mô phỏng)', totals.refundedAmount, MONEY, 'Hoàn tiền mô phỏng đã hoàn tất, tính theo ngày hoàn tất.');
  metric('net', 'Thu ròng (mô phỏng)', { formula: `B${at.gross}-B${at.refund}`, result: totals.netRevenue }, MONEY, 'Đã thu − đã hoàn trong kỳ; có thể âm khi hoàn tiền nhiều hơn tiền thu trong kỳ.');
  metric('orders', 'Đơn đã xác nhận', totals.confirmedOrders, COUNT, 'Đơn đã thanh toán (mô phỏng), tính theo ngày xác nhận.');
  metric('sold', 'Vé đã bán', totals.soldTickets, COUNT, 'Tổng số vé trong các đơn đã xác nhận.');
  metric('capacity', 'Sức chứa hạng vé', totals.capacity, COUNT, 'Tổng sức chứa các hạng vé của các sự kiện trong phạm vi; không lọc theo ngày.');
  metric('fill', 'Tỷ lệ lấp đầy', { formula: `IF(B${at.capacity}>0,B${at.sold}/B${at.capacity},0)`, result: fraction(totals.fillRate) }, PERCENT, 'Vé đã bán ÷ sức chứa, tính trên tổng của mọi sự kiện (không lấy trung bình phần trăm từng sự kiện).');
  metric('issued', 'Vé phát hành', totals.issuedTickets, COUNT, 'Vé đã phát hành theo ngày phát hành, gồm cả vé sau đó bị hủy.');
  metric('admitted', 'Vé đã vào cổng', totals.admissions, COUNT, 'Số vé khác nhau có lượt quét thành công trong kỳ (không phải số người mua duy nhất).');
  metric('attendance', 'Tỷ lệ tham dự', { formula: `IF(B${at.sold}>0,B${at.admitted}/B${at.sold},0)`, result: fraction(totals.attendanceRate) }, PERCENT, 'Vé đã vào cổng ÷ vé đã bán. Khi lọc ngày, tỷ lệ tham dự có thể vượt 100% vì ngày mua và ngày vào cổng khác nhau.');
  metric('scans', 'Lượt quét tại cổng', totals.scans, COUNT, 'Mọi lần quét, gồm cả lượt bị từ chối.');
  metric('rejected', 'Lượt quét bị từ chối', totals.rejectedScans, COUNT, 'Vé đã dùng, sai sự kiện, vé hủy, mã không hợp lệ…');
  info.addRow([]);

  section(info, 'Cách đọc file');
  const notes = [
    `• Sheet "Theo sự kiện": mỗi dòng một sự kiện${all ? ', hàng cuối là tổng cộng (cộng bằng SUM; tỷ lệ = tổng tử số ÷ tổng mẫu số)' : ''}. Bấm mũi tên ở dòng tiêu đề để lọc hoặc sắp xếp.`,
    '• Sheet "Doanh thu theo kỳ": tiền đã thu, đã hoàn và thu ròng theo từng kỳ; hàng cuối là tổng.',
    ...(all ? ['• "Tất cả sự kiện" gồm mọi sự kiện đã mở bán: đã kết thúc, đã hủy và chưa có hoạt động. Bản nháp chưa từng mở bán nên không tính.'] : []),
    '• Mỗi chỉ số lọc theo thời điểm riêng của nó (xác nhận đơn, phát hành vé, vào cổng, thanh toán, hoàn tiền). Bỏ giới hạn ngày để xem tỷ lệ tổng thể.',
    '• File được tạo từ đúng bản dữ liệu chụp đang hiển thị trên màn hình, không đọc lại cơ sở dữ liệu lúc tải.',
  ];
  for (const note of notes) {
    const row = info.addRow([note]);
    info.mergeCells(`A${row.number}:C${row.number}`);
    row.alignment = { wrapText: true, vertical: 'top' };
    row.height = 30;
  }

  // ---- Theo sự kiện (header on row 1, one row per Event, optional totals row outside the filter)
  const sheet = book.addWorksheet('Theo sự kiện', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  sheet.columns = [
    { header: 'Sự kiện', key: 'name', width: 42 }, { header: 'Ngày diễn ra', key: 'startTime', width: 14 },
    { header: 'Trạng thái', key: 'status', width: 14 },
    { header: 'Đơn đã xác nhận', key: 'confirmedOrders', width: 13 }, { header: 'Vé đã bán', key: 'soldTickets', width: 11 },
    { header: 'Sức chứa', key: 'capacity', width: 11 }, { header: 'Tỷ lệ lấp đầy', key: 'fillRate', width: 12 },
    { header: 'Vé phát hành', key: 'issuedTickets', width: 12 }, { header: 'Vé đã vào cổng', key: 'admissions', width: 12 },
    { header: 'Tỷ lệ tham dự', key: 'attendanceRate', width: 12 },
    { header: 'Lượt quét', key: 'scans', width: 11 }, { header: 'Lượt bị từ chối', key: 'rejectedScans', width: 12 },
    { header: 'Đã thu (mô phỏng)', key: 'grossRevenue', width: 18 }, { header: 'Đã hoàn (mô phỏng)', key: 'refundedAmount', width: 18 },
    { header: 'Thu ròng (mô phỏng)', key: 'netRevenue', width: 18 },
  ];
  headerRow(sheet.getRow(1));
  sheet.getRow(1).height = 36;
  // Counts, money and rates stay numeric (rates as Excel fractions: 40% = 0.4) so the file reconciles.
  for (const event of data.events) {
    sheet.addRow({
      name: event.name, startTime: event.startTime ? vnCell(event.startTime) : null, status: STATUS_LABELS[event.status] ?? event.status,
      confirmedOrders: Number(event.confirmedOrders), soldTickets: Number(event.soldTickets), capacity: Number(event.capacity),
      fillRate: fraction(event.fillRate), issuedTickets: Number(event.issuedTickets), admissions: Number(event.admissions),
      attendanceRate: fraction(event.attendanceRate), scans: Number(event.scans), rejectedScans: Number(event.rejectedScans),
      grossRevenue: Number(event.grossRevenue), refundedAmount: Number(event.refundedAmount), netRevenue: Number(event.netRevenue),
    });
  }
  const eventRows = sheet.rowCount;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, eventRows), column: sheet.columnCount } };
  if (all) {
    const first = 2; const last = Math.max(first, eventRows);
    const row = sheet.addRow({ name: `Tổng cộng (${data.events.length} sự kiện)` });
    const n = row.number;
    const letter = (key: string) => sheet.getColumn(key).letter;
    for (const key of ['confirmedOrders', 'soldTickets', 'capacity', 'issuedTickets', 'admissions', 'scans', 'rejectedScans', 'grossRevenue', 'refundedAmount'] as const) {
      row.getCell(key).value = data.events.length > 0 ? { formula: `SUM(${letter(key)}${first}:${letter(key)}${last})`, result: totals[key] } : totals[key];
    }
    // Ratio of the summed cells: never the mean of per-Event percentages.
    row.getCell('fillRate').value = { formula: `IF(${letter('capacity')}${n}>0,${letter('soldTickets')}${n}/${letter('capacity')}${n},0)`, result: fraction(totals.fillRate) };
    row.getCell('attendanceRate').value = { formula: `IF(${letter('soldTickets')}${n}>0,${letter('admissions')}${n}/${letter('soldTickets')}${n},0)`, result: fraction(totals.attendanceRate) };
    row.getCell('netRevenue').value = { formula: `${letter('grossRevenue')}${n}-${letter('refundedAmount')}${n}`, result: totals.netRevenue };
    row.font = { bold: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: { style: 'thin', color: { argb: BRAND } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });
  }
  sheet.getColumn('startTime').numFmt = 'dd/mm/yyyy';
  for (const key of ['fillRate', 'attendanceRate']) sheet.getColumn(key).numFmt = PERCENT;
  for (const key of ['confirmedOrders', 'soldTickets', 'capacity', 'issuedTickets', 'admissions', 'scans', 'rejectedScans']) sheet.getColumn(key).numFmt = COUNT;
  for (const key of ['grossRevenue', 'refundedAmount', 'netRevenue']) sheet.getColumn(key).numFmt = MONEY;

  // ---- Doanh thu theo kỳ
  const trend = book.addWorksheet('Doanh thu theo kỳ', { views: [{ state: 'frozen', ySplit: 1 }] });
  trend.columns = [
    { header: `Kỳ (${GROUP_LABELS[filters.groupBy].toLowerCase()})`, key: 'period', width: 16 },
    { header: 'Đã thu (mô phỏng)', key: 'grossRevenue', width: 20 }, { header: 'Đã hoàn (mô phỏng)', key: 'refundedAmount', width: 20 },
    { header: 'Thu ròng (mô phỏng)', key: 'netRevenue', width: 20 },
  ];
  headerRow(trend.getRow(1));
  for (const point of data.revenueSeries) {
    const period = periodCell(point.period, filters.groupBy);
    const row = trend.addRow({ period: period.value, grossRevenue: Number(point.grossRevenue), refundedAmount: Number(point.refundedAmount) });
    row.getCell('netRevenue').value = { formula: `B${row.number}-C${row.number}`, result: Number(point.netRevenue) };
    if (period.numFmt) row.getCell('period').numFmt = period.numFmt;
    row.getCell('period').alignment = { horizontal: 'left' };
  }
  const trendRows = trend.rowCount;
  trend.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, trendRows), column: trend.columnCount } };
  if (data.revenueSeries.length > 0) {
    const sumOf = (key: 'grossRevenue' | 'refundedAmount' | 'netRevenue') => data.revenueSeries.reduce((acc, point) => acc + Number(point[key]), 0);
    const row = trend.addRow({ period: 'Tổng cộng' });
    row.getCell('grossRevenue').value = { formula: `SUM(B2:B${trendRows})`, result: sumOf('grossRevenue') };
    row.getCell('refundedAmount').value = { formula: `SUM(C2:C${trendRows})`, result: sumOf('refundedAmount') };
    row.getCell('netRevenue').value = { formula: `B${row.number}-C${row.number}`, result: sumOf('netRevenue') };
    row.font = { bold: true };
    row.eachCell({ includeEmpty: true }, (cell) => { cell.border = { top: { style: 'thin', color: { argb: BRAND } } }; });
  }
  for (const key of ['grossRevenue', 'refundedAmount', 'netRevenue']) trend.getColumn(key).numFmt = MONEY;

  return book.xlsx.writeBuffer();
}
