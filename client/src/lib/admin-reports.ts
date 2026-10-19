/**
 * Pure helpers for the Admin "Báo cáo" page (Khôi's module, UI only). Every figure comes from
 * `/admin/reports` (one server snapshot); these helpers only map URL state and labels. Ratios
 * are the server's summed numerator / summed denominator (`rates`), never recomputed here.
 */
import type { EventReport, OperationFilters, RateBasis } from "@/services/report.service";

import { isoDay, rangeSlug } from "./admin-date-range";

export type GroupBy = "day" | "month" | "year";
export const GROUP_LABEL: Record<GroupBy, string> = { day: "Ngày", month: "Tháng", year: "Năm" };

const positiveId = (value: string | null) => (value && /^[1-9]\d{0,9}$/.test(value) ? value : "");
export const groupFromParam = (value: string | null): GroupBy => (value === "month" || value === "year" ? value : "day");

/** URL → report filters; malformed values are dropped and an inverted range loses `to`. */
export function reportFiltersFromParams(params: URLSearchParams): OperationFilters & { groupBy: GroupBy } {
  const from = isoDay(params.get("from"));
  let to = isoDay(params.get("to"));
  if (from && to && from > to) to = "";
  return { eventId: positiveId(params.get("eventId")), from, to, groupBy: groupFromParam(params.get("groupBy")) };
}

export const reportKey = (filters: OperationFilters) => [filters.eventId, filters.from, filters.to, filters.groupBy ?? "day"].join("|");

export function reportFiltersFromKey(key: string): OperationFilters & { groupBy: GroupBy } {
  const [eventId = "", from = "", to = "", groupBy = "day"] = key.split("|");
  return { eventId, from, to, groupBy: groupFromParam(groupBy) };
}

/** Axis label: "18/10", "10/2026", "2026". */
export function periodLabel(period: string, groupBy: GroupBy) {
  const [year, month, day] = period.split("-");
  if (groupBy === "year" || !month) return year;
  if (groupBy === "month" || !day) return `${month}/${year}`;
  return `${day}/${month}`;
}

/** Tooltip/table label: "18/10/2026", "Tháng 10/2026", "Năm 2026". */
export function periodTitle(period: string, groupBy: GroupBy) {
  const [year, month, day] = period.split("-");
  if (groupBy === "year" || !month) return `Năm ${year}`;
  if (groupBy === "month" || !day) return `Tháng ${month}/${year}`;
  return `${day}/${month}/${year}`;
}

/** "15 / 1.010" helper input: the server's own numerator and denominator. */
export const rateParts = (basis: RateBasis) => ({ numerator: basis.numerator, denominator: basis.denominator, ratio: basis.percent / 100 });

export interface FunnelStep { key: "capacity" | "sold" | "issued" | "admitted"; label: string; value: number; share: number; note: string }

/**
 * Ticket path for the scope: capacity → sold → issued → admitted. Bars are relative to the
 * largest value so a sold-out or a date-filtered (>100%) scope still draws honestly.
 */
export function ticketFunnel(report: Pick<EventReport, "capacity" | "soldTickets" | "issuedTickets" | "admissions">): FunnelStep[] {
  const steps: Array<Omit<FunnelStep, "share">> = [
    { key: "capacity", label: "Sức chứa hạng vé", value: report.capacity, note: "Tổng sức chứa các hạng vé, không lọc theo ngày" },
    { key: "sold", label: "Vé đã bán", value: report.soldTickets, note: "Theo ngày xác nhận đơn" },
    { key: "issued", label: "Vé phát hành", value: report.issuedTickets, note: "Theo ngày phát hành, gồm vé sau đó bị hủy" },
    { key: "admitted", label: "Vé đã vào cổng", value: report.admissions, note: "Vé khác nhau có lượt quét thành công" },
  ];
  const max = Math.max(1, ...steps.map((step) => step.value));
  return steps.map((step) => ({ ...step, share: step.value / max }));
}

/** Rejected scans as a share of all scans in scope (0 when there were none). */
export const rejectedShare = (report: Pick<EventReport, "scans" | "rejectedScans">) => (report.scans > 0 ? report.rejectedScans / report.scans : 0);

/** ASCII file name: bao-cao_tat-ca-su-kien_2026-10-01_den_2026-10-18_theo-thang.xlsx */
export function reportFileName(filters: OperationFilters, now: number) {
  const scope = filters.eventId ? `su-kien-${filters.eventId}` : "tat-ca-su-kien";
  const group = filters.groupBy === "year" ? "nam" : filters.groupBy === "month" ? "thang" : "ngay";
  return `bao-cao_${scope}_${rangeSlug(filters, now)}_theo-${group}.xlsx`;
}
