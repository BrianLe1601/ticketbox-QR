import type { CheckinResult } from "@/services/checkin.service";

export type VerdictTone = "success" | "warning" | "failed";
export interface ScanVerdict { label: string; tone: VerdictTone; allow: boolean }

/**
 * A gate verdict is read from a distance and in sunlight, so every outcome has its own words:
 * colour and icon only reinforce it. Only SUCCESS lets a ticket holder in.
 */
const VERDICTS: Record<CheckinResult["code"], ScanVerdict> = {
  SUCCESS: { label: "CHO VÀO", tone: "success", allow: true },
  ALREADY_CHECKED_IN: { label: "VÉ ĐÃ DÙNG", tone: "warning", allow: false },
  EVENT_NOT_AVAILABLE: { label: "NGOÀI GIỜ CHECK-IN", tone: "warning", allow: false },
  WRONG_EVENT: { label: "SAI SỰ KIỆN", tone: "failed", allow: false },
  CANCELLED: { label: "VÉ ĐÃ HỦY", tone: "failed", allow: false },
  UNPAID: { label: "ĐƠN CHƯA THANH TOÁN", tone: "failed", allow: false },
  INVALID: { label: "MÃ KHÔNG HỢP LỆ", tone: "failed", allow: false },
  STAFF_NOT_ASSIGNED: { label: "CHƯA ĐƯỢC PHÂN CÔNG", tone: "failed", allow: false },
};

/** No result (network failure, timeout): never imply the ticket was accepted. */
const UNKNOWN: ScanVerdict = { label: "CHƯA XÁC ĐỊNH", tone: "failed", allow: false };

export function scanVerdict(code: CheckinResult["code"] | null | undefined): ScanVerdict {
  return code ? VERDICTS[code] ?? UNKNOWN : UNKNOWN;
}

/** Gate window as "13:00 – 16:30" in Vietnam time, for the event context bar. */
export function gateWindow(startIso: string, endIso: string): string {
  const time = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  return `${time(startIso)} – ${time(endIso)}`;
}

// Short labels for the history list; the tone reuses the gate verdict so both read the same.
export const CHECKIN_LABELS: Record<string, string> = {
  SUCCESS: 'Cho vào',
  ALREADY_CHECKED_IN: 'Vé đã dùng',
  WRONG_EVENT: 'Sai sự kiện',
  CANCELLED: 'Vé đã hủy',
  UNPAID: 'Chưa thanh toán',
  INVALID: 'Không hợp lệ',
  EVENT_NOT_AVAILABLE: 'Ngoài giờ check-in',
  STAFF_NOT_ASSIGNED: 'Chưa phân công',
};

