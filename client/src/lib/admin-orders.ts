/**
 * Pure helpers for the Admin "Đơn hàng" page (Tài's module). They only decide what the UI offers;
 * every rule is re-checked by server/src/modules/orders/admin-orders.service.ts. Moved out of the
 * page unchanged when it was rebuilt on the Bento reference (UI-only change).
 */
import type {
  AdminOrderListItem, AdminOrderStatus, AdminOrderDetail, AdminOrderEmailLog, RefundStatus, RefundSummary,
} from "@/services/admin-orders.service";

export type OrderStatusFilter = "all" | AdminOrderStatus;
export const ORDER_STATUSES: AdminOrderStatus[] = ["pending_payment", "confirmed", "expired", "cancelled"];

export function statusFromParam(value: string | null): OrderStatusFilter {
  return ORDER_STATUSES.includes(value as AdminOrderStatus) ? (value as AdminOrderStatus) : "all";
}

/** Same condition the old page used: confirmed, public Event on sale or running, not yet ended. */
export function canResendTicketEmail(order: Pick<AdminOrderListItem, "status" | "eventStatus" | "eventVisibility" | "eventEndTime">, now: number) {
  return order.status === "confirmed"
    && order.eventVisibility === "visible"
    && ["published", "ongoing"].includes(order.eventStatus)
    && new Date(order.eventEndTime).getTime() > now;
}

/** A simulated refund workflow exists only for confirmed Orders of a cancelled Event. */
export function hasRefundWorkflow(order: Pick<AdminOrderListItem, "status" | "eventStatus" | "refundStatus">) {
  return order.eventStatus === "cancelled" && order.status === "confirmed" && Boolean(order.refundStatus) && order.refundStatus !== "not_required";
}

/** A failed email can be retried unless another email of the same type is already queued. */
export function canRetryEmail(log: AdminOrderEmailLog, detail: AdminOrderDetail, now: number) {
  return log.status === "failed"
    && log.emailType !== "order_cancelled"
    && canResendTicketEmail(detail, now)
    && !detail.emailLogs.some((other) => other.emailType === log.emailType && (other.status === "pending" || other.status === "processing"));
}

export type StepState = "done" | "current" | "failed" | "todo";

/** The three refund steps: recorded → processing → completed/failed. */
export function refundSteps(status: RefundStatus): [StepState, StepState, StepState] {
  if (status === "completed") return ["done", "done", "done"];
  if (status === "failed") return ["done", "done", "failed"];
  if (status === "processing") return ["done", "current", "todo"];
  return ["current", "todo", "todo"];
}

export type BulkTarget = "processing" | "completed";

/** What a bulk action on a cancelled Event will touch (from the server's refund summary). */
export function bulkImpact(summary: RefundSummary, target: BulkTarget) {
  return target === "processing"
    ? { orders: summary.pending + summary.failed, tickets: summary.pendingTicketQuantity + summary.failedTicketQuantity, amount: summary.pendingAmount + summary.failedAmount }
    : { orders: summary.processing, tickets: summary.processingTicketQuantity, amount: summary.processingAmount };
}

/** "3/5 yêu cầu cần hoàn đã hoàn tất mô phỏng" (needs exclude "not required"). */
export function refundProgress(summary: RefundSummary) {
  const needed = summary.total - summary.notRequired;
  return { done: summary.completed, needed };
}

export const EMAIL_TYPE_LABEL: Record<AdminOrderEmailLog["emailType"], string> = {
  ticket_issued: "Phát hành vé",
  ticket_resent: "Gửi lại vé",
  order_cancelled: "Thông báo hủy sự kiện",
};

/* ---------- refund centre (every cancelled Event, no Event picked first) ---------- */

type EventOption = { id: number; name: string; status: string; refundSummary: RefundSummary };

export interface RefundCentreRow {
  id: number; name: string; summary: RefundSummary;
  /** Requests not finished yet (pending + failed + processing). */
  open: number; openTickets: number; openAmount: number;
}

/** Cancelled Events that still have unfinished simulated refunds, largest amount first. */
export function refundCentre(events: readonly EventOption[]) {
  const cancelled = events.filter((event) => event.status === "cancelled" && event.refundSummary.total - event.refundSummary.notRequired > 0);
  const rows: RefundCentreRow[] = cancelled.map((event) => {
    const s = event.refundSummary;
    return {
      id: event.id, name: event.name, summary: s,
      open: s.pending + s.failed + s.processing,
      openTickets: s.pendingTicketQuantity + s.failedTicketQuantity + s.processingTicketQuantity,
      openAmount: s.pendingAmount + s.failedAmount + s.processingAmount,
    };
  }).filter((row) => row.open > 0).sort((a, b) => b.openAmount - a.openAmount || a.id - b.id);
  const sum = (pick: (row: RefundCentreRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const finished = cancelled.reduce((total, event) => total + event.refundSummary.completed, 0);
  return {
    rows,
    totals: { events: rows.length, open: sum((r) => r.open), tickets: sum((r) => r.openTickets), amount: sum((r) => r.openAmount), failed: sum((r) => r.summary.failed), finished },
  };
}

export type RefundRunMode = "finish" | "processing" | "complete";

/**
 * Server calls for one Event. "finish" = Hoàn tất ngay: pending/failed → processing, then
 * processing → completed (the server still records both transitions). The second call only runs
 * when something is in processing after the first.
 */
export function refundRunSteps(summary: RefundSummary, mode: RefundRunMode): BulkTarget[] {
  const startable = summary.pending + summary.failed;
  if (mode === "processing") return startable > 0 ? ["processing"] : [];
  if (mode === "complete") return summary.processing > 0 ? ["completed"] : [];
  return startable + summary.processing > 0 ? (startable > 0 ? ["processing", "completed"] : ["completed"]) : [];
}

/** What a run will touch, for the confirmation dialog. */
export function runImpact(rows: readonly RefundCentreRow[], mode: RefundRunMode) {
  const pick = (row: RefundCentreRow) => mode === "processing"
    ? { orders: row.summary.pending + row.summary.failed, tickets: row.summary.pendingTicketQuantity + row.summary.failedTicketQuantity, amount: row.summary.pendingAmount + row.summary.failedAmount, failed: row.summary.failed }
    : mode === "complete"
      ? { orders: row.summary.processing, tickets: row.summary.processingTicketQuantity, amount: row.summary.processingAmount, failed: 0 }
      : { orders: row.open, tickets: row.openTickets, amount: row.openAmount, failed: row.summary.failed };
  const start = { events: 0, orders: 0, tickets: 0, amount: 0, failed: 0 };
  return rows.map(pick).reduce<typeof start>((acc, item) => ({ events: acc.events + (item.orders > 0 ? 1 : 0), orders: acc.orders + item.orders, tickets: acc.tickets + item.tickets, amount: acc.amount + item.amount, failed: acc.failed + item.failed }), start);
}
