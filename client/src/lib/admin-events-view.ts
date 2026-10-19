/**
 * Pure view logic for Admin Events (filters, counts, calendar, Kanban rules). The page and its
 * tests share it, so a summary card count always uses the same predicate as the rows it shows.
 * Lifecycle decisions stay on the server: these rules only decide which action to *offer*.
 */
import { readinessSummary } from "@/lib/admin-readiness";
import type { AdminEvent, EventStatus } from "@/services/admin-events.service";

export const EVENT_STATUSES: EventStatus[] = ["draft", "published", "ongoing", "completed", "cancelled"];
export type StatusFilter = "all" | EventStatus;
export type EventCounts = Record<StatusFilter, number>;

type CountableEvent = Pick<AdminEvent, "status">;
type FilterableEvent = Pick<AdminEvent, "status" | "category" | "name" | "venue" | "city">;

export function eventCounts(events: readonly CountableEvent[]): EventCounts {
  const counts: EventCounts = { all: events.length, draft: 0, published: 0, ongoing: 0, completed: 0, cancelled: 0 };
  for (const event of events) counts[event.status] += 1;
  return counts;
}

function normalize(text: string) {
  return text.normalize("NFC").toLocaleLowerCase("vi-VN").trim();
}

export function matchesStatus(event: CountableEvent, status: StatusFilter) {
  return status === "all" || event.status === status;
}

/** One predicate for every view (cards, list, calendar, Kanban). Search ignores case and edges. */
export function filterEvents<T extends FilterableEvent>(events: readonly T[], filter: { status: StatusFilter; category: string; query: string }): T[] {
  const query = normalize(filter.query);
  return events.filter((event) =>
    matchesStatus(event, filter.status)
    && (filter.category === "all" || event.category === filter.category)
    && (!query || normalize(`${event.name} ${event.venue} ${event.city} ${event.category}`).includes(query)),
  );
}

/** Sold share of the tiers' allocated capacity, 0..1 (0 when nothing is allocated yet). */
export function soldShare(event: Pick<AdminEvent, "soldQuantity" | "allocatedCapacity">) {
  return event.allocatedCapacity > 0 ? Math.min(1, event.soldQuantity / event.allocatedCapacity) : 0;
}

/* ---------- Vietnam calendar ---------- */

const VN_OFFSET_MS = 7 * 3_600_000;

/** "2026-10-18" for the Vietnam calendar day of an instant (UTC+7, no DST). */
export function vnDateKey(iso: string | Date): string {
  const date = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  return date.toISOString().slice(0, 10);
}

export interface MonthCursor { year: number; month: number } // month 1..12

export function monthOf(iso: string | Date): MonthCursor {
  const [year, month] = vnDateKey(iso).split("-").map(Number);
  return { year, month };
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const index = cursor.year * 12 + (cursor.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export interface CalendarDay { key: string; day: number; inMonth: boolean; weekday: number }

/** Six Monday-first weeks covering the month (42 days), as Vietnam date keys. */
export function monthGrid(cursor: MonthCursor): CalendarDay[][] {
  const first = Date.UTC(cursor.year, cursor.month - 1, 1);
  const offset = (new Date(first).getUTCDay() + 6) % 7; // Monday = 0
  const start = first - offset * 86_400_000;
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start + (w * 7 + d) * 86_400_000);
      week.push({ key: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: date.getUTCMonth() === cursor.month - 1, weekday: d });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Events grouped by the Vietnam day they start, each day sorted by start time. */
export function eventsByDay<T extends Pick<AdminEvent, "startTime">>(events: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  const sorted = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  for (const event of sorted) {
    const key = vnDateKey(event.startTime);
    const list = map.get(key);
    if (list) list.push(event); else map.set(key, [event]);
  }
  return map;
}

export function monthLabel(cursor: MonthCursor) {
  return `Tháng ${cursor.month}/${cursor.year}`;
}

/* ---------- actions & Kanban ---------- */

type ActionEvent = Pick<AdminEvent, "status" | "visibility" | "soldQuantity" | "pendingOrderCount" | "confirmedOrderCount" | "readiness">;

const TERMINAL: EventStatus[] = ["completed", "cancelled"];

export interface Availability { allowed: boolean; reason?: string }

export function canPublish(event: ActionEvent): Availability {
  if (event.status !== "draft") return { allowed: false, reason: "Chỉ bản nháp mới được công bố." };
  if (!event.readiness.ready) return { allowed: false, reason: `Chưa đủ điều kiện: ${readinessSummary(event.readiness.missing)}` };
  return { allowed: true };
}

export function canCancel(event: ActionEvent): Availability {
  if (event.status === "published" || event.status === "ongoing") return { allowed: true };
  if (event.status === "draft") return { allowed: false, reason: "Bản nháp không hủy được; hãy xóa nếu chưa có đơn." };
  return { allowed: false, reason: "Sự kiện đã ở trạng thái kết thúc." };
}

export function canDelete(event: ActionEvent): Availability {
  if (event.status !== "draft") return { allowed: false, reason: "Chỉ xóa được bản nháp; sự kiện khác dùng Hủy." };
  if (event.soldQuantity > 0 || event.pendingOrderCount > 0 || event.confirmedOrderCount > 0) return { allowed: false, reason: "Bản nháp đã có đơn hàng." };
  return { allowed: true };
}

export function canEdit(event: ActionEvent): Availability {
  return TERMINAL.includes(event.status) ? { allowed: false, reason: "Sự kiện đã kết thúc hoặc đã hủy, chỉ xem." } : { allowed: true };
}

export function canToggleVisibility(event: ActionEvent): Availability {
  return TERMINAL.includes(event.status) ? { allowed: false, reason: "Không đổi hiển thị của sự kiện đã kết thúc hoặc đã hủy." } : { allowed: true };
}

export type KanbanDrop =
  | { action: "publish" | "cancel" }
  | { action: "none" }
  | { action: "reject"; reason: string };

/**
 * What dropping a card on another column means. Only two transitions are Admin actions
 * (publish a Draft, cancel a Published/Ongoing Event); both still open a confirmation and the
 * server re-checks them. "ongoing"/"completed" follow the clock and are never set by hand.
 */
export function kanbanDrop(event: ActionEvent, to: EventStatus): KanbanDrop {
  if (event.status === to) return { action: "none" };
  if (TERMINAL.includes(event.status)) return { action: "reject", reason: "Sự kiện đã kết thúc hoặc đã hủy, không đổi trạng thái được." };
  if (to === "published") {
    const check = canPublish(event);
    return check.allowed ? { action: "publish" } : { action: "reject", reason: check.reason! };
  }
  if (to === "cancelled") {
    const check = canCancel(event);
    return check.allowed ? { action: "cancel" } : { action: "reject", reason: check.reason! };
  }
  if (to === "ongoing" || to === "completed") return { action: "reject", reason: "Máy chủ tự chuyển sang Đang diễn ra / Đã kết thúc theo giờ bắt đầu và kết thúc." };
  return { action: "reject", reason: "Không thể đưa sự kiện về bản nháp." };
}
