import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";

export interface DashboardCountsRow extends RowDataPacket {
  activeEvents: number;
  draftEvents: number;
  scheduledEvents: number;
  hiddenEvents: number;
  failedScheduledEvents: number;
  totalIssuedTickets: number;
  todayCheckinSuccess: number;
  activeStaffCount: number;
  pendingStaffApprovalCount: number;
  confirmedOrdersCount: number;
  pendingOrdersCount: number;
  totalRevenue: number;
  pendingRefundCount: number;
  pendingRefundAmount: number;
}

export interface UnstaffedEventRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  startTime: Date;
  endTime: Date;
  status: string;
}

export interface FailedScheduledEventRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  scheduledPublishAt: Date | null;
  lastPublishAttemptAt: Date | null;
  publishFailureReason: string | null;
}

export async function getDashboardSummaryCounts(): Promise<DashboardCountsRow> {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM events WHERE status IN ('published', 'ongoing') AND end_time > NOW(3)) AS activeEvents,
      (SELECT COUNT(*) FROM events WHERE status = 'draft') AS draftEvents,
      (SELECT COUNT(*) FROM events WHERE status = 'draft' AND scheduled_publish_at IS NOT NULL) AS scheduledEvents,
      (SELECT COUNT(*) FROM events WHERE visibility = 'hidden') AS hiddenEvents,
      (SELECT COUNT(*) FROM events WHERE status = 'draft' AND publish_failure_reason IS NOT NULL) AS failedScheduledEvents,
      (SELECT COUNT(*) FROM tickets WHERE status = 'issued') AS totalIssuedTickets,
      (SELECT COUNT(*) FROM checkin_logs WHERE result_code = 'SUCCESS' AND checked_at >= CURRENT_DATE()) AS todayCheckinSuccess,
      (SELECT COUNT(DISTINCT staff_id) FROM event_staff WHERE is_active = TRUE) AS activeStaffCount,
      (SELECT COUNT(*) FROM users WHERE role = 'staff' AND staff_approval_status = 'pending') AS pendingStaffApprovalCount,
      (SELECT COUNT(*) FROM orders WHERE status = 'confirmed') AS confirmedOrdersCount,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending_payment') AS pendingOrdersCount,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'confirmed') AS totalRevenue,
      (SELECT COUNT(*) FROM refunds WHERE status = 'pending') AS pendingRefundCount,
      (SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE status = 'pending') AS pendingRefundAmount
  `;

  const [rows] = await pool.query<DashboardCountsRow[]>(query);
  return (
    rows[0] ??
    ({
      activeEvents: 0,
      draftEvents: 0,
      scheduledEvents: 0,
      hiddenEvents: 0,
      failedScheduledEvents: 0,
      totalIssuedTickets: 0,
      todayCheckinSuccess: 0,
      activeStaffCount: 0,
      pendingStaffApprovalCount: 0,
      confirmedOrdersCount: 0,
      pendingOrdersCount: 0,
      totalRevenue: 0,
      pendingRefundCount: 0,
      pendingRefundAmount: 0,
    } as DashboardCountsRow)
  );
}

export async function getUnstaffedUpcomingEvents(limit = 5): Promise<UnstaffedEventRow[]> {
  const query = `
    SELECT e.id, e.name, e.slug, e.start_time AS startTime, e.end_time AS endTime, e.status
    FROM events e
    WHERE e.status IN ('published', 'ongoing')
      AND e.end_time > NOW(3)
      AND NOT EXISTS (
        SELECT 1 FROM event_staff es WHERE es.event_id = e.id AND es.is_active = TRUE
      )
    ORDER BY e.start_time ASC
    LIMIT ?
  `;

  const [rows] = await pool.query<UnstaffedEventRow[]>(query, [limit]);
  return rows;
}

export async function getScheduledPublishFailedEvents(limit = 5): Promise<FailedScheduledEventRow[]> {
  const query = `
    SELECT e.id, e.name, e.slug, e.scheduled_publish_at AS scheduledPublishAt,
           e.last_publish_attempt_at AS lastPublishAttemptAt, e.publish_failure_reason AS publishFailureReason
    FROM events e
    WHERE e.status = 'draft' AND e.publish_failure_reason IS NOT NULL
    ORDER BY e.last_publish_attempt_at DESC
    LIMIT ?
  `;

  const [rows] = await pool.query<FailedScheduledEventRow[]>(query, [limit]);
  return rows;
}

