import ExcelJS from 'exceljs';
import type { ReportRow, LogRow } from './report.repository.js';
import type { ReportQuery } from './report.schema.js';

function workbook(query: { eventId: number; from?: string | undefined; to?: string | undefined; groupBy?: 'day' | 'month' | 'year' | undefined }) {
  const book = new ExcelJS.Workbook();
  book.creator = 'TicketBox QR';
  const info = book.addWorksheet('Bộ lọc');
  info.columns = [{ header: 'Thông tin', key: 'name', width: 32 }, { header: 'Giá trị', key: 'value', width: 80 }];
  info.addRows([
    ['Event ID', query.eventId], ['Từ ngày', query.from ?? 'Không giới hạn'], ['Đến hết ngày', query.to ?? 'Không giới hạn'],
    ['Nhóm doanh thu', query.groupBy === 'year' ? 'Năm' : query.groupBy === 'month' ? 'Tháng' : 'Ngày'],
    ['Múi giờ', 'Asia/Ho_Chi_Minh (UTC+07:00)'], ['Xuất lúc (UTC)', new Date().toISOString()],
    ['Cách tính', 'Thanh toán mô phỏng theo paid_at; hoàn tiền mô phỏng theo completed_at; lượt vào theo log SUCCESS; mỗi chỉ số lọc thời điểm riêng.'],
    ['Tiền tệ', 'VND mô phỏng; thu ròng mô phỏng = đã thu mô phỏng - đã hoàn mô phỏng trong kỳ, có thể âm. Không có giao dịch tiền thật.'],
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
  const statusLabels: Record<string, string> = {
    draft: 'Bản nháp', published: 'Đã công bố', ongoing: 'Đang diễn ra',
    completed: 'Đã kết thúc', cancelled: 'Đã hủy',
  };
  const info = book.getWorksheet('Bộ lọc')!;
  info.addRows([
    ['Tên sự kiện', report.name], ['Trạng thái sự kiện', statusLabels[report.status] ?? report.status],
    ['Đơn xác nhận / vé đã bán', 'Đơn đã xác nhận theo thời điểm xác nhận; vé đã bán là tổng số lượng trong các đơn đó.'],
    ['Vé phát hành', 'Số vé theo thời điểm phát hành, gồm vé sau đó bị hủy để giữ lịch sử.'],
    ['Vé đã vào cổng', 'Số vé khác nhau có lượt xác nhận thành công trong khoảng ngày đã chọn; không phải số người mua duy nhất.'],
    ['Tỷ lệ lấp đầy', 'Vé đã bán trong bộ lọc / tổng sức chứa các hạng vé của sự kiện. Mẫu số không lọc theo ngày.'],
    ['Tỷ lệ tham dự', 'Vé đã vào cổng trong bộ lọc / vé đã bán trong bộ lọc. Mẫu số bằng 0 thì hiển thị 0%, giống báo cáo trên màn hình.'],
    ['Lưu ý khoảng ngày', 'Ngày mua vé và ngày vào cổng có thể khác nhau. Khi lọc ngày, tỷ lệ tham dự có thể vượt 100%; bỏ giới hạn ngày để xem tỷ lệ tổng thể của sự kiện.'],
    ['Tính cập nhật', 'File lấy dữ liệu mới tại lúc xuất theo bộ lọc đã áp dụng; có thể khác màn hình nếu vừa phát sinh giao dịch.'],
    ['Xuất lúc (giờ Việt Nam)', new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })],
  ]);
  info.getColumn('value').alignment = { vertical: 'top', wrapText: true };
  for (let row = 8; row <= info.rowCount; row++) info.getRow(row).height = 44;
  const sheet = book.addWorksheet('Báo cáo sự kiện');
  sheet.columns = [
    { header: 'Sự kiện', key: 'name', width: 45 }, { header: 'Trạng thái', key: 'status', width: 18 },
    { header: 'Đơn xác nhận', key: 'confirmedOrders', width: 18 }, { header: 'Vé đã bán', key: 'soldTickets', width: 16 },
    { header: 'Tổng sức chứa vé', key: 'capacity', width: 20 }, { header: 'Tỷ lệ lấp đầy (%)', key: 'fillRate', width: 20 },
    { header: 'Vé phát hành', key: 'issuedTickets', width: 18 }, { header: 'Vé đã vào', key: 'admissions', width: 16 },
    { header: 'Tỷ lệ tham dự (%)', key: 'attendanceRate', width: 21 },
    { header: 'Tổng lần quét', key: 'scans', width: 18 }, { header: 'Quét từ chối', key: 'rejectedScans', width: 18 },
    { header: 'Thanh toán mô phỏng (VND)', key: 'grossRevenue', width: 30 }, { header: 'Hoàn tiền mô phỏng (VND)', key: 'refundedAmount', width: 30 },
    { header: 'Thu ròng mô phỏng (VND)', key: 'netRevenue', width: 28 },
  ];
  // Excel stores percentages as fractions (40% = 0.4). The API uses 40.
  // Keep all counts/money numeric so the exported file can be reconciled.
  const values: Record<string, string | number> = {
    name: report.name, status: statusLabels[report.status] ?? report.status,
  };
  for (const key of [
    'confirmedOrders', 'soldTickets', 'capacity', 'issuedTickets', 'admissions',
    'scans', 'rejectedScans', 'grossRevenue', 'refundedAmount', 'netRevenue',
  ] as const) values[key] = Number(report[key]);
  values.fillRate = Number(report.fillRate) / 100;
  values.attendanceRate = Number(report.attendanceRate) / 100;
  sheet.addRow(values);
  for (const key of ['fillRate', 'attendanceRate']) sheet.getColumn(key).numFmt = '0.00%';
  for (const key of ['confirmedOrders', 'soldTickets', 'capacity', 'issuedTickets', 'admissions', 'scans', 'rejectedScans']) sheet.getColumn(key).numFmt = '#,##0';
  for (const key of ['grossRevenue', 'refundedAmount', 'netRevenue']) sheet.getColumn(key).numFmt = '#,##0.00';
  const trend = book.addWorksheet('Doanh thu theo kỳ');
  trend.columns = [
    { header: query.groupBy === 'year' ? 'Kỳ (năm)' : query.groupBy === 'month' ? 'Kỳ (tháng)' : 'Kỳ (ngày)', key: 'period', width: 18 },
    { header: 'Đã thu mô phỏng (VND)', key: 'grossRevenue', width: 28 },
    { header: 'Đã hoàn mô phỏng (VND)', key: 'refundedAmount', width: 30 },
    { header: 'Thu ròng mô phỏng (VND)', key: 'netRevenue', width: 28 },
  ];
  trend.addRows(report.revenueSeries.map((point) => ({
    period: point.period, grossRevenue: Number(point.grossRevenue),
    refundedAmount: Number(point.refundedAmount), netRevenue: Number(point.netRevenue),
  })));
  for (const key of ['grossRevenue', 'refundedAmount', 'netRevenue']) trend.getColumn(key).numFmt = '#,##0.00';
  style(book);
  for (const reportSheet of [sheet, trend]) {
    reportSheet.getRow(1).height = 42;
    reportSheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  }
  return book.xlsx.writeBuffer();
}
export async function logsWorkbook(query: {
  eventId: number; from?: string | undefined; to?: string | undefined;
  staffId?: number | undefined; result?: string | undefined;
}, logs: LogRow[]) {
  const book = workbook(query);
  book.getWorksheet('Bộ lọc')!.addRows([['Staff ID', query.staffId ?? 'Tất cả'], ['Kết quả', query.result ?? 'Tất cả']]);
  const sheet = book.addWorksheet('Lịch sử check-in');
  sheet.columns = [
    { header: 'Log ID', key: 'id', width: 12 }, { header: 'Sự kiện', key: 'eventName', width: 40 },
    { header: 'Staff ID', key: 'staffId', width: 12 }, { header: 'Nhân viên', key: 'staffName', width: 26 },
    { header: 'Mã vé', key: 'ticketCode', width: 25 }, { header: 'Trạng thái vé', key: 'ticketStatus', width: 18 },
    { header: 'Hạng vé', key: 'ticketTypeName', width: 26 }, { header: 'Người giữ vé', key: 'holderName', width: 26 },
    { header: 'Email người giữ vé', key: 'holderEmail', width: 32 }, { header: 'Mã đơn hàng', key: 'orderCode', width: 24 },
    { header: 'Người mua', key: 'buyerName', width: 26 }, { header: 'Email người mua', key: 'buyerEmail', width: 32 },
    { header: 'Số điện thoại', key: 'buyerPhone', width: 18 }, { header: 'Kết quả', key: 'result', width: 26 },
    { header: 'Mã đã che', key: 'scannedCode', width: 18 }, { header: 'Thông báo', key: 'message', width: 55 },
    { header: 'Thời điểm (UTC+07)', key: 'time', width: 28 },
  ];
  // Strings are explicit cell values, never formula objects, even when starting '='.
  for (const log of logs) sheet.addRow({ ...log, time: new Date(log.checkedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }) });
  style(book);
  return book.xlsx.writeBuffer();
}
