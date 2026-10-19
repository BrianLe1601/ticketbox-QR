/**
 * Pure helpers for the Admin "Nhật ký check-in" page (Khôi's module, UI only). The server owns
 * every count (`/admin/checkins` meta.stats over the snapshot); these helpers only map URL state,
 * labels and date ranges. Result labels match the Excel file (server report.export.ts).
 */
import type { CheckinLogStats, OperationFilters } from "@/services/report.service";

import { isoDay, rangeSlug } from "./admin-date-range";

export const RESULT_CODES = [
  "SUCCESS", "ALREADY_CHECKED_IN", "WRONG_EVENT", "CANCELLED", "UNPAID", "INVALID", "EVENT_NOT_AVAILABLE", "STAFF_NOT_ASSIGNED",
] as const;
export type ResultCode = (typeof RESULT_CODES)[number];
/** `FAILED` is the server's "every rejected scan" filter, not a stored code. */
export type ResultFilter = "" | "FAILED" | ResultCode;

export const RESULT_LABEL: Record<ResultCode | "FAILED", string> = {
  SUCCESS: "Vào cổng thành công",
  FAILED: "Tất cả lượt bị từ chối",
  ALREADY_CHECKED_IN: "Vé đã được sử dụng",
  WRONG_EVENT: "Vé của sự kiện khác",
  CANCELLED: "Vé đã bị hủy",
  UNPAID: "Đơn chưa thanh toán",
  INVALID: "Mã không hợp lệ",
  EVENT_NOT_AVAILABLE: "Ngoài giờ check-in",
  STAFF_NOT_ASSIGNED: "Nhân viên chưa được phân công",
};

export const resultLabel = (code: string) => RESULT_LABEL[code as ResultCode] ?? code;

/** Current Ticket state (not the state at scan time). */
export const TICKET_STATE_LABEL: Record<string, string> = {
  issued: "Chưa vào cổng", checked_in: "Đã vào cổng", cancelled: "Đã hủy",
};

/** Summary cards: each one is exactly the server filter of the same name. */
export const RESULT_SEGMENTS: Array<{ key: ResultFilter; label: string; stat: keyof CheckinLogStats }> = [
  { key: "", label: "Tổng lượt quét", stat: "total" },
  { key: "SUCCESS", label: "Vào cổng thành công", stat: "success" },
  { key: "FAILED", label: "Bị từ chối", stat: "rejected" },
  { key: "ALREADY_CHECKED_IN", label: "Vé quét trùng", stat: "duplicate" },
  { key: "INVALID", label: "Mã không hợp lệ", stat: "invalid" },
];

const positiveId = (value: string | null) => (value && /^[1-9]\d{0,9}$/.test(value) ? value : "");

export function resultFromParam(value: string | null): ResultFilter {
  return value === "FAILED" || RESULT_CODES.includes(value as ResultCode) ? (value as ResultFilter) : "";
}

/** URL → filters; unknown or malformed values are dropped, an inverted range drops `to`. */
export function filtersFromParams(params: URLSearchParams): OperationFilters {
  const from = isoDay(params.get("from"));
  let to = isoDay(params.get("to"));
  if (from && to && from > to) to = "";
  return {
    eventId: positiveId(params.get("eventId")), from, to,
    staffId: positiveId(params.get("staffId")), result: resultFromParam(params.get("result")),
  };
}

/** Stable key of what defines a snapshot; a different key needs a fresh one. */
export const filterKey = (filters: OperationFilters) =>
  [filters.eventId, filters.from, filters.to, filters.staffId ?? "", filters.result ?? ""].join("|");

export function filtersFromKey(key: string): OperationFilters {
  const [eventId = "", from = "", to = "", staffId = "", result = ""] = key.split("|");
  return { eventId, from, to, staffId, result };
}

/** Share of all scans in scope, for the card hints ("62,5% lượt quét"). */
export function shareOf(stats: CheckinLogStats, stat: keyof CheckinLogStats) {
  return stats.total > 0 ? stats[stat] / stats.total : 0;
}

/** Rejected scans that are neither duplicates nor invalid codes (wrong Event, cancelled, unpaid, out of window…). */
export const otherRejected = (stats: CheckinLogStats) => Math.max(0, stats.rejected - stats.duplicate - stats.invalid);

/** ASCII file name describing scope and range; without a range it carries the export day. */
export function exportFileName(filters: Pick<OperationFilters, "eventId" | "from" | "to">, now: number) {
  const scope = filters.eventId ? `su-kien-${filters.eventId}` : "tat-ca-su-kien";
  return `nhat-ky-check-in_${scope}_${rangeSlug(filters, now)}.xlsx`;
}
