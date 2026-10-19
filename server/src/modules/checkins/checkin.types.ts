export const resultMessages = {
  SUCCESS: 'Check-in thành công.',
  ALREADY_CHECKED_IN: 'Vé đã được check-in trước đó.',
  WRONG_EVENT: 'Vé không thuộc sự kiện đang chọn.',
  CANCELLED: 'Vé đã bị hủy.',
  UNPAID: 'Đơn hàng chưa được xác nhận.',
  INVALID: 'Mã vé không hợp lệ.',
  EVENT_NOT_AVAILABLE: 'Sự kiện chưa mở hoặc đã đóng check-in.',
  STAFF_NOT_ASSIGNED: 'Bạn chưa được phân công hoặc đã bị thu hồi quyền tại sự kiện này.',
} as const;
export type ResultCode = keyof typeof resultMessages;
export interface ScanResult {
  code: ResultCode;
  message: string;
  checkedAt: Date;
  /** ticketTypeName is the purchase snapshot (order_items.ticket_type_name); never sent for WRONG_EVENT. */
  ticket: { code: string; holderName: string | null; ticketTypeName: string | null; checkedInAt: Date | null } | null;
}

/** Gate-wide attendance of one Event (not one Staff member). */
export interface Attendance {
  /** Distinct Tickets with a SUCCESS scan: the same predicate as Admin Reports "admissions". */
  admitted: number;
  /** Tickets of confirmed Orders that are still valid (issued or checked in). */
  validTickets: number;
  /** Valid Tickets not yet checked in. */
  remaining: number;
}
