/**
 * Derived Admin to-dos and suggestions. Pure functions over API data already loaded by the
 * shell (dashboard summary + published/ongoing Events): nothing here invents a figure.
 * This is not a notification centre (no persistence, read state or push); see AGENTS.md.
 */
import { formatDateTime, formatMoney, formatNumber } from "./admin-format";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type TaskSeverity = "urgent" | "todo";
export interface AdminTask {
  id: string;
  severity: TaskSeverity;
  kind: "publish-failed" | "unstaffed" | "staff-approval" | "refund";
  title: string;
  detail: string;
  to: string;
  action: string;
}

export interface TaskSummaryInput {
  staff: { pendingApproval: number };
  refunds: { pendingCount: number; pendingAmount: number };
  alerts: {
    unstaffedUpcomingEvents: Array<{ id: number; name: string; startTime: string }>;
    scheduledPublishFailedEvents: Array<{ id: number; name: string; publishFailureReason: string | null }>;
  };
}

/** The server returns at most this many rows per alert list. */
export const ALERT_LIST_LIMIT = 5;

export function buildTasks(summary: TaskSummaryInput | null, now: Date = new Date()): { tasks: AdminTask[]; truncated: boolean } {
  if (!summary) return { tasks: [], truncated: false };
  const tasks: AdminTask[] = [];
  for (const event of summary.alerts.scheduledPublishFailedEvents) {
    tasks.push({
      id: `publish-${event.id}`, severity: "urgent", kind: "publish-failed",
      title: "Hẹn giờ công bố thất bại", detail: `${event.name}${event.publishFailureReason ? ` · ${event.publishFailureReason}` : ""}`,
      to: `/admin/events?focus=${event.id}`, action: "Xem sự kiện",
    });
  }
  for (const event of summary.alerts.unstaffedUpcomingEvents) {
    const startsIn = Date.parse(event.startTime) - now.getTime();
    tasks.push({
      id: `unstaffed-${event.id}`, severity: startsIn <= 2 * DAY ? "urgent" : "todo", kind: "unstaffed",
      title: "Chưa có nhân viên trực cổng", detail: `${event.name} · bắt đầu ${formatDateTime(event.startTime)}`,
      to: `/admin/staff?assignEvent=${event.id}`, action: "Phân công",
    });
  }
  if (summary.staff.pendingApproval > 0) {
    tasks.push({
      id: "staff-approval", severity: "todo", kind: "staff-approval",
      title: `${formatNumber(summary.staff.pendingApproval)} tài khoản nhân viên chờ duyệt`, detail: "Đăng nhập Google lần đầu, chưa có quyền vào cổng",
      to: "/admin/staff?tab=pending", action: "Duyệt",
    });
  }
  if (summary.refunds.pendingCount > 0) {
    tasks.push({
      id: "refunds", severity: "todo", kind: "refund",
      title: `${formatNumber(summary.refunds.pendingCount)} yêu cầu hoàn tiền (mô phỏng) chờ xử lý`, detail: `Tổng ${formatMoney(summary.refunds.pendingAmount)}`,
      to: "/admin/orders?view=refunds", action: "Xử lý",
    });
  }
  const order: Record<TaskSeverity, number> = { urgent: 0, todo: 1 };
  tasks.sort((a, b) => order[a.severity] - order[b.severity]);
  const truncated = summary.alerts.unstaffedUpcomingEvents.length >= ALERT_LIST_LIMIT
    || summary.alerts.scheduledPublishFailedEvents.length >= ALERT_LIST_LIMIT;
  return { tasks, truncated };
}

export interface InsightEvent {
  id: number;
  name: string;
  status: string;
  startTime: string;
  salesStartAt: string;
  salesEndAt: string;
  allocatedCapacity: number;
  soldQuantity: number;
}

export interface Suggestion {
  id: string;
  tone: "warning" | "info" | "danger";
  title: string;
  detail: string;
  to: string;
  action: string;
}

export function sellThrough(event: Pick<InsightEvent, "allocatedCapacity" | "soldQuantity">): number {
  return event.allocatedCapacity > 0 ? event.soldQuantity / event.allocatedCapacity : 0;
}

/**
 * Rule-based suggestions (shown as "gợi ý tự động"). Rules use only Event inventory and
 * schedule; no pricing advice and no gate/device alerts (that data does not exist yet).
 */
export function buildSuggestions(events: readonly InsightEvent[], now: Date = new Date(), limit = 4): Suggestion[] {
  const t = now.getTime();
  const out: Array<Suggestion & { rank: number }> = [];
  for (const event of events) {
    const start = Date.parse(event.startTime);
    if (Number.isNaN(start) || start <= t || event.allocatedCapacity <= 0) continue;
    const ratio = sellThrough(event);
    const percent = Math.round(ratio * 100);
    const salesOpen = Date.parse(event.salesStartAt) <= t && t <= Date.parse(event.salesEndAt);
    const days = Math.max(0, Math.ceil((start - t) / DAY));
    if (event.soldQuantity >= event.allocatedCapacity) {
      out.push({ id: `soldout-${event.id}`, tone: "info", rank: 2, title: "Đã bán hết vé", detail: `${event.name} · ${formatNumber(event.soldQuantity)}/${formatNumber(event.allocatedCapacity)} vé`, to: `/admin/ticket-types?eventId=${event.id}`, action: "Xem hạng vé" });
    } else if (ratio >= 0.8) {
      out.push({ id: `almost-${event.id}`, tone: "warning", rank: 1, title: "Sắp hết vé", detail: `${event.name} · đã bán ${percent}% (${formatNumber(event.soldQuantity)}/${formatNumber(event.allocatedCapacity)})`, to: `/admin/ticket-types?eventId=${event.id}`, action: "Xem hạng vé" });
    } else if (salesOpen && start - t <= 7 * DAY && ratio < 0.3) {
      out.push({ id: `slow-${event.id}`, tone: "danger", rank: 0, title: "Bán chậm", detail: `${event.name} · mới bán ${percent}%, còn ${days} ngày`, to: `/admin/events?focus=${event.id}`, action: "Xem sự kiện" });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, limit).map((item) => ({
    id: item.id, tone: item.tone, title: item.title, detail: item.detail, to: item.to, action: item.action,
  }));
}

/** Next Events by start time (ongoing first), for the dashboard list. */
export function upcomingEvents<T extends InsightEvent>(events: readonly T[], now: Date = new Date(), limit = 5): T[] {
  const t = now.getTime();
  return events
    .filter((event) => event.status === "ongoing" || Date.parse(event.startTime) > t)
    .sort((a, b) => (a.status === "ongoing" ? -1 : 0) - (b.status === "ongoing" ? -1 : 0) || Date.parse(a.startTime) - Date.parse(b.startTime))
    .slice(0, limit);
}

/** "còn 3 ngày", "còn 5 giờ", "đang diễn ra". */
export function startsInLabel(startIso: string, status: string, now: Date = new Date()): string {
  if (status === "ongoing") return "Đang diễn ra";
  const diff = Date.parse(startIso) - now.getTime();
  if (Number.isNaN(diff)) return "";
  if (diff <= 0) return "Sắp bắt đầu";
  if (diff < HOUR) return `còn ${Math.max(1, Math.round(diff / 60_000))} phút`;
  if (diff < DAY) return `còn ${Math.round(diff / HOUR)} giờ`;
  return `còn ${Math.ceil(diff / DAY)} ngày`;
}

/**
 * Tasks that appeared since the previous snapshot (drives "new task" toasts). The first
 * snapshot (previous = null) never counts as new, so loading a page does not spam toasts.
 */
export function newTasks<T extends { id: string }>(previousIds: ReadonlySet<string> | null, tasks: readonly T[]): T[] {
  if (!previousIds) return [];
  return tasks.filter((task) => !previousIds.has(task.id));
}

/** Tasks the Admin has not opened the bell for yet. */
export function unseenTasks<T extends { id: string }>(seenIds: ReadonlySet<string>, tasks: readonly T[]): T[] {
  return tasks.filter((task) => !seenIds.has(task.id));
}
