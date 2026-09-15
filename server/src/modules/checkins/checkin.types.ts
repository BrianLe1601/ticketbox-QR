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
  ticket: { code: string; holderName: string | null; checkedInAt: Date | null } | null;
}
