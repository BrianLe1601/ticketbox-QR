import ExcelJS from 'exceljs';
import type { ReportRow, LogRow } from './report.repository.js';
import type { ReportQuery } from './report.schema.js';

function workbook(query: ReportQuery) {
  const book = new ExcelJS.Workbook();
  book.creator = 'TicketBox QR';
  const info = book.addWorksheet('Bộ lọc');
  info.columns = [{ header: 'Thông tin', key: 'name', width: 32 }, { header: 'Giá trị', key: 'value', width: 80 }];
  info.addRows([
    ['Event ID', query.eventId], ['Từ ngày', query.from ?? 'Không giới hạn'], ['Đến hết ngày', query.to ?? 'Không giới hạn'],
    ['Múi giờ', 'Asia/Ho_Chi_Minh (UTC+07:00)'], ['Xuất lúc (UTC)', new Date().toISOString()],
    ['Cách tính', 'Thu theo paid_at; hoàn theo completed_at; lượt vào theo log SUCCESS; mỗi chỉ số lọc thời điểm riêng.'],
    ['Tiền tệ', 'VND; thu ròng = đã thu - đã hoàn trong kỳ, có thể âm.'],
  ]);
  return book;
}
function style(book: ExcelJS.Workbook) {
  for (const sheet of book.worksheets) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E63' } };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: sheet.columnCount } };
  }
}
export async function reportWorkbook(query: ReportQuery, report: ReportRow) {
  const book = workbook(query);
  const sheet = book.addWorksheet('Báo cáo sự kiện');
  sheet.columns = [
    { header: 'Sự kiện', key: 'name', width: 45 }, { header: 'Trạng thái', key: 'status', width: 18 },
    { header: 'Đơn xác nhận', key: 'confirmedOrders', width: 18 }, { header: 'Vé đã bán', key: 'soldTickets', width: 16 },
    { header: 'Vé phát hành', key: 'issuedTickets', width: 18 }, { header: 'Vé đã vào', key: 'admissions', width: 16 },
    { header: 'Tổng lần quét', key: 'scans', width: 18 }, { header: 'Quét từ chối', key: 'rejectedScans', width: 18 },
    { header: 'Đã thu (VND)', key: 'grossRevenue', width: 22 }, { header: 'Đã hoàn (VND)', key: 'refundedAmount', width: 22 },
    { header: 'Thu ròng (VND)', key: 'netRevenue', width: 22 },
  ];
  sheet.addRow(report);
  for (const key of ['grossRevenue', 'refundedAmount', 'netRevenue']) sheet.getColumn(key).numFmt = '#,##0.00';
  style(book);
  return book.xlsx.writeBuffer();
}
export async function logsWorkbook(query: ReportQuery & { staffId?: number | undefined; result?: string | undefined }, logs: LogRow[]) {
  const book = workbook(query);
  book.getWorksheet('Bộ lọc')!.addRows([['Staff ID', query.staffId ?? 'Tất cả'], ['Kết quả', query.result ?? 'Tất cả']]);
  const sheet = book.addWorksheet('Lịch sử check-in');
  sheet.columns = [
    { header: 'Log ID', key: 'id', width: 12 }, { header: 'Sự kiện', key: 'eventName', width: 40 },
    { header: 'Staff ID', key: 'staffId', width: 12 }, { header: 'Nhân viên', key: 'staffName', width: 26 },
    { header: 'Mã vé', key: 'ticketCode', width: 25 }, { header: 'Kết quả', key: 'result', width: 26 },
    { header: 'Mã đã che', key: 'scannedCode', width: 18 }, { header: 'Thông báo', key: 'message', width: 55 },
    { header: 'Thời điểm (UTC+07)', key: 'time', width: 28 },
  ];
  // Strings are explicit cell values, never formula objects, even when starting '='.
  for (const log of logs) sheet.addRow({ ...log, time: new Date(log.checkedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) });
  style(book);
  return book.xlsx.writeBuffer();
}
