/**
 * One status vocabulary for every Admin page. Keys are the persisted API/DB values, never
 * translated text, so UI never infers state from a label. Payment and refund labels always
 * say "mô phỏng" because no real money moves in this project.
 */
export type StatusTone = "neutral" | "muted" | "primary" | "info" | "success" | "warning" | "danger" | "live";
export type StatusDomain = "event" | "visibility" | "order" | "payment" | "refund" | "ticket" | "staff" | "tier" | "scan" | "email" | "category";

export interface StatusStyle { label: string; tone: StatusTone; }

const REGISTRY: Record<StatusDomain, Record<string, StatusStyle>> = {
  event: {
    draft: { label: "Bản nháp", tone: "neutral" },
    published: { label: "Đã công bố", tone: "info" },
    ongoing: { label: "Đang diễn ra", tone: "live" },
    completed: { label: "Đã kết thúc", tone: "muted" },
    cancelled: { label: "Đã hủy", tone: "danger" },
  },
  visibility: {
    visible: { label: "Đang hiển thị", tone: "success" },
    hidden: { label: "Đang ẩn", tone: "warning" },
  },
  order: {
    pending_payment: { label: "Chờ thanh toán", tone: "warning" },
    confirmed: { label: "Đã xác nhận", tone: "success" },
    expired: { label: "Hết hạn", tone: "muted" },
    cancelled: { label: "Đã hủy", tone: "danger" },
  },
  payment: {
    pending: { label: "Thanh toán (mô phỏng) · Đang chờ", tone: "warning" },
    success: { label: "Thanh toán (mô phỏng) · Thành công", tone: "success" },
    failed: { label: "Thanh toán (mô phỏng) · Thất bại", tone: "danger" },
    cancelled: { label: "Thanh toán (mô phỏng) · Đã hủy", tone: "muted" },
  },
  refund: {
    not_required: { label: "Không cần hoàn tiền", tone: "muted" },
    pending: { label: "Hoàn tiền (mô phỏng) · Chờ xử lý", tone: "warning" },
    processing: { label: "Hoàn tiền (mô phỏng) · Đang xử lý", tone: "info" },
    completed: { label: "Hoàn tiền (mô phỏng) · Hoàn tất", tone: "success" },
    failed: { label: "Hoàn tiền (mô phỏng) · Thất bại", tone: "danger" },
  },
  ticket: {
    issued: { label: "Đã phát hành", tone: "info" },
    checked_in: { label: "Đã check-in", tone: "success" },
    cancelled: { label: "Đã hủy", tone: "danger" },
  },
  staff: {
    pending: { label: "Chờ duyệt", tone: "warning" },
    active: { label: "Đang hoạt động", tone: "success" },
    inactive: { label: "Đã vô hiệu hóa", tone: "muted" },
    rejected: { label: "Đã từ chối", tone: "danger" },
  },
  tier: {
    active: { label: "Đang bán", tone: "success" },
    scheduled: { label: "Sắp mở bán", tone: "info" },
    paused: { label: "Tạm dừng", tone: "warning" },
    sold_out: { label: "Hết vé", tone: "danger" },
    closed: { label: "Đã đóng bán", tone: "muted" },
  },
  scan: {
    SUCCESS: { label: "Hợp lệ", tone: "success" },
    ALREADY_CHECKED_IN: { label: "Vé đã dùng", tone: "warning" },
    EVENT_NOT_AVAILABLE: { label: "Ngoài giờ check-in", tone: "warning" },
    WRONG_EVENT: { label: "Sai sự kiện", tone: "danger" },
    CANCELLED: { label: "Vé đã hủy", tone: "danger" },
    UNPAID: { label: "Đơn chưa thanh toán", tone: "danger" },
    INVALID: { label: "Mã không hợp lệ", tone: "danger" },
    STAFF_NOT_ASSIGNED: { label: "Chưa được phân công", tone: "danger" },
  },
  email: {
    pending: { label: "Chờ gửi", tone: "warning" },
    processing: { label: "Đang gửi", tone: "info" },
    sent: { label: "Đã gửi", tone: "success" },
    failed: { label: "Gửi lỗi", tone: "danger" },
  },
  category: {
    active: { label: "Đang hoạt động", tone: "success" },
    inactive: { label: "Đã vô hiệu hóa", tone: "muted" },
  },
};

export function statusStyle(domain: StatusDomain, status: string | null | undefined): StatusStyle {
  const value = String(status ?? "");
  return REGISTRY[domain][value] ?? { label: value ? `Không rõ (${value})` : "Không rõ", tone: "neutral" };
}

/** Values known for a domain, in display order; used by filters and the UI catalogue. */
export function statusValues(domain: StatusDomain): string[] {
  return Object.keys(REGISTRY[domain]);
}

/** Staff display state from the two persisted fields (approval + active flag). */
export function staffState(approvalStatus: "pending" | "approved" | "rejected", isActive: boolean): "pending" | "active" | "inactive" | "rejected" {
  if (approvalStatus === "pending") return "pending";
  if (approvalStatus === "rejected") return "rejected";
  return isActive ? "active" : "inactive";
}

/** Scan results that should be flagged at the gate (fake/duplicate/other-event tickets). */
export function isScanAlert(code: string | null | undefined): boolean {
  return code === "INVALID" || code === "ALREADY_CHECKED_IN" || code === "WRONG_EVENT";
}
