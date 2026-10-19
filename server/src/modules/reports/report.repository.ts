import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/pool.js';
import { withDerived, type EventMetrics } from './report.metrics.js';
import type { EventSearchQuery, LogQuery, ReportQuery } from './report.schema.js';

/** "All Events" holds every non-Draft Event: a Draft has never been on sale, so it would only dilute the capacity denominator. */
export const MAX_REPORT_EVENTS = 2000;

export interface ReportEventRow extends EventMetrics { id: number; name: string; status: string; startTime: Date | string }
export interface RevenuePoint extends RowDataPacket {
  period: string; grossRevenue: number; refundedAmount: number; netRevenue: number;
}
export interface EventOption extends RowDataPacket { id: number; name: string; status: string; startTime: Date }
export interface LogStats {
  total: number; success: number; rejected: number; duplicate: number; invalid: number;
}
export interface LogRow extends RowDataPacket {
  id: number; eventId: number; eventName: string; staffId: number; staffName: string;
  ticketCode: string | null; ticketStatus: string | null; ticketTypeName: string | null;
  holderName: string | null; holderEmail: string | null; orderCode: string | null;
  buyerName: string | null; buyerEmail: string | null; buyerPhone: string | null;
  result: string; scannedCode: string | null; message: string | null; checkedAt: Date;
}

// A report and its paginated count use one read-only snapshot while gates keep scanning.
export async function readSnapshot<T>(work: (conn: PoolConnection) => Promise<T>) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conn.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
export function dateFilter(column: string, query: { from?: string | undefined; to?: string | undefined }) {
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  if (query.from) { clauses.push(`${column} >= ?`); values.push(`${query.from} 00:00:00`); }
  if (query.to) { clauses.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`); values.push(`${query.to} 00:00:00`); }
  return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values };
}
export async function findEvent(conn: PoolConnection, id: number) {
  const [rows] = await conn.execute<RowDataPacket[]>('SELECT id, name, status FROM events WHERE id = ?', [id]);
  return rows[0];
}

/** Event picker: every non-Draft Event (terminal and zero-activity ones included), newest first, paginated. */
export async function searchEvents(query: EventSearchQuery) {
  const where = "status <> 'draft' AND (? = '' OR LOCATE(?, name) > 0)";
  const [rows] = await pool.query<EventOption[]>(
    `SELECT id, name, status, start_time AS startTime FROM events WHERE ${where}
      ORDER BY start_time DESC, id DESC LIMIT ? OFFSET ?`,
    [query.q, query.q, query.limit, (query.page - 1) * query.limit]);
  const [count] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM events WHERE ${where}`, [query.q, query.q]);
  return { rows, total: Number(count[0]?.total ?? 0) };
}

/**
 * One row per Event in scope. Every source is aggregated independently inside its own
 * subquery: joining Payments x Tickets x Logs would multiply money and counts.
 */
export async function reportRows(conn: PoolConnection, query: Pick<ReportQuery, 'eventId' | 'from' | 'to'>): Promise<ReportEventRow[]> {
  const orders = dateFilter('o.confirmed_at', query);
  const issued = dateFilter('t.issued_at', query);
  const scans = dateFilter('cl.checked_at', query);
  const paid = dateFilter('p.paid_at', query);
  const refunds = dateFilter('r.completed_at', query);
  const scope = query.eventId ? 'e.id = ?' : "e.status <> 'draft'";
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT e.id, e.name, e.status, e.start_time AS startTime,
    (SELECT COUNT(*) FROM orders o WHERE o.event_id = e.id AND o.status = 'confirmed' ${orders.sql}) AS confirmedOrders,
    (SELECT COALESCE(SUM(o.total_quantity), 0) FROM orders o WHERE o.event_id = e.id AND o.status = 'confirmed' ${orders.sql}) AS soldTickets,
    (SELECT COUNT(*) FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id JOIN orders o ON o.id = oi.order_id
      WHERE o.event_id = e.id ${issued.sql}) AS issuedTickets,
    (SELECT COUNT(DISTINCT cl.ticket_id) FROM checkin_logs cl WHERE cl.event_id = e.id AND cl.result_code = 'SUCCESS' ${scans.sql}) AS admissions,
    (SELECT COUNT(*) FROM checkin_logs cl WHERE cl.event_id = e.id ${scans.sql}) AS scans,
    (SELECT COUNT(*) FROM checkin_logs cl WHERE cl.event_id = e.id AND cl.result_code <> 'SUCCESS' ${scans.sql}) AS rejectedScans,
    (SELECT COALESCE(SUM(tt.capacity), 0) FROM ticket_types tt WHERE tt.event_id = e.id) AS capacity,
    (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE o.event_id = e.id AND p.status = 'success' ${paid.sql}) AS grossRevenue,
    (SELECT COALESCE(SUM(r.amount), 0) FROM refunds r JOIN orders o ON o.id = r.order_id
      WHERE o.event_id = e.id AND r.status = 'completed' ${refunds.sql}) AS refundedAmount
    FROM events e WHERE ${scope} ORDER BY e.start_time DESC, e.id DESC LIMIT ${MAX_REPORT_EVENTS + 1}`, [
    ...orders.values, ...orders.values, ...issued.values, ...scans.values, ...scans.values, ...scans.values,
    ...paid.values, ...refunds.values, ...(query.eventId ? [query.eventId] : []),
  ]);
  return rows.map((row) => ({
    id: Number(row.id), name: String(row.name), status: String(row.status), startTime: row.startTime as Date,
    ...withDerived({
      confirmedOrders: Number(row.confirmedOrders), soldTickets: Number(row.soldTickets),
      issuedTickets: Number(row.issuedTickets), admissions: Number(row.admissions),
      scans: Number(row.scans), rejectedScans: Number(row.rejectedScans), capacity: Number(row.capacity),
      grossRevenue: Number(row.grossRevenue), refundedAmount: Number(row.refundedAmount),
    }),
  }));
}

export async function revenueSeries(conn: PoolConnection, query: Pick<ReportQuery, 'eventId' | 'from' | 'to' | 'groupBy'>): Promise<RevenuePoint[]> {
  const format = query.groupBy === 'year' ? '%Y' : query.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const paid = dateFilter('p.paid_at', query);
  const refunds = dateFilter('r.completed_at', query);
  const scope = query.eventId ? 'o.event_id = ?' : "o.event_id IN (SELECT id FROM events WHERE status <> 'draft')";
  const scopeValues = query.eventId ? [query.eventId] : [];
  const [rows] = await conn.query<RevenuePoint[]>(`SELECT period,
      COALESCE(SUM(grossRevenue), 0) AS grossRevenue,
      COALESCE(SUM(refundedAmount), 0) AS refundedAmount,
      COALESCE(SUM(grossRevenue), 0) - COALESCE(SUM(refundedAmount), 0) AS netRevenue
    FROM (
      SELECT DATE_FORMAT(p.paid_at, '${format}') AS period, SUM(p.amount) AS grossRevenue, 0 AS refundedAmount
      FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE ${scope} AND p.status = 'success' ${paid.sql}
      GROUP BY DATE_FORMAT(p.paid_at, '${format}')
      UNION ALL
      SELECT DATE_FORMAT(r.completed_at, '${format}') AS period, 0 AS grossRevenue, SUM(r.amount) AS refundedAmount
      FROM refunds r JOIN orders o ON o.id = r.order_id
      WHERE ${scope} AND r.status = 'completed' ${refunds.sql}
      GROUP BY DATE_FORMAT(r.completed_at, '${format}')
    ) totals
    GROUP BY period ORDER BY period ASC`, [
    ...scopeValues, ...paid.values,
    ...scopeValues, ...refunds.values,
  ]);
  return rows.map((point) => ({
    ...point,
    grossRevenue: Number(point.grossRevenue),
    refundedAmount: Number(point.refundedAmount),
    netRevenue: Number(point.netRevenue),
  }));
}

/** Filters that define which logs belong to a view. `watermark` freezes the append-only table at snapshot time. */
export interface LogScope {
  eventId?: number | undefined; from?: string | undefined; to?: string | undefined;
  staffId?: number | undefined; result?: string | undefined;
}

function logConditions(scope: LogScope, watermark: number, withResult: boolean) {
  const dates = dateFilter('cl.checked_at', scope);
  let sql = `cl.id <= ?${dates.sql}`;
  const values: (string | number)[] = [watermark, ...dates.values];
  if (scope.eventId) { sql += ' AND cl.event_id = ?'; values.push(scope.eventId); }
  if (scope.staffId) { sql += ' AND cl.staff_id = ?'; values.push(scope.staffId); }
  if (withResult) {
    if (scope.result === 'FAILED') sql += " AND cl.result_code <> 'SUCCESS'";
    else if (scope.result) { sql += ' AND cl.result_code = ?'; values.push(scope.result); }
  }
  return { sql, values };
}
export const logFilter = (scope: LogScope, watermark: number) => logConditions(scope, watermark, true);

export async function maxLogId(conn: PoolConnection) {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT COALESCE(MAX(id), 0) AS maxId FROM checkin_logs');
  return Number(rows[0]?.maxId ?? 0);
}

export async function logStats(conn: PoolConnection, scope: LogScope, watermark: number): Promise<LogStats> {
  const filter = logConditions(scope, watermark, false);
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT
    COUNT(*) AS total,
    COALESCE(SUM(cl.result_code = 'SUCCESS'), 0) AS success,
    COALESCE(SUM(cl.result_code <> 'SUCCESS'), 0) AS rejected,
    COALESCE(SUM(cl.result_code = 'ALREADY_CHECKED_IN'), 0) AS duplicate,
    COALESCE(SUM(cl.result_code = 'INVALID'), 0) AS invalid
    FROM checkin_logs cl WHERE ${filter.sql}`, filter.values);
  const row = rows[0]!;
  return {
    total: Number(row.total), success: Number(row.success), rejected: Number(row.rejected),
    duplicate: Number(row.duplicate), invalid: Number(row.invalid),
  };
}
export async function countLogs(conn: PoolConnection, scope: LogScope, watermark: number) {
  const filter = logFilter(scope, watermark);
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkin_logs cl WHERE ${filter.sql}`, filter.values);
  return Number(rows[0]!.total);
}
export async function logs(conn: PoolConnection, scope: LogScope, watermark: number, limit: number, offset: number) {
  const filter = logFilter(scope, watermark);
  const [rows] = await conn.query<LogRow[]>(`SELECT cl.id, cl.event_id AS eventId, e.name AS eventName,
    cl.staff_id AS staffId, u.full_name AS staffName, t.ticket_code AS ticketCode,
    t.status AS ticketStatus, oi.ticket_type_name AS ticketTypeName,
    t.holder_name AS holderName, t.holder_email AS holderEmail,
    o.order_code AS orderCode, o.buyer_name AS buyerName,
    o.buyer_email AS buyerEmail, o.buyer_phone AS buyerPhone,
    cl.result_code AS result, cl.scanned_code_masked AS scannedCode, cl.message, cl.checked_at AS checkedAt
    FROM checkin_logs cl JOIN events e ON e.id = cl.event_id JOIN users u ON u.id = cl.staff_id
    LEFT JOIN tickets t ON t.id = cl.ticket_id
    LEFT JOIN order_items oi ON oi.id = t.order_item_id
    LEFT JOIN orders o ON o.id = oi.order_id
    WHERE ${filter.sql} ORDER BY cl.checked_at DESC, cl.id DESC LIMIT ? OFFSET ?`, [...filter.values, limit, offset]);
  return rows;
}
