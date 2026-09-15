import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/pool.js';
import type { LogQuery, ReportQuery } from './report.schema.js';

export interface ReportRow extends RowDataPacket {
  id: number; name: string; status: string; confirmedOrders: number; soldTickets: number;
  issuedTickets: number; admissions: number; scans: number; rejectedScans: number;
  grossRevenue: number; refundedAmount: number; netRevenue: number;
}
export interface LogRow extends RowDataPacket {
  id: number; eventId: number; eventName: string; staffId: number; staffName: string;
  ticketCode: string | null; result: string; scannedCode: string | null; message: string | null; checkedAt: Date;
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
export function dateFilter(column: string, query: ReportQuery) {
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
export async function searchEvents(q: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id, name, status FROM events
    WHERE LOCATE(?, name) > 0 ORDER BY start_time DESC, id DESC LIMIT 100`, [q]);
  return rows;
}
export async function report(conn: PoolConnection, query: ReportQuery): Promise<ReportRow | undefined> {
  const orders = dateFilter('o.confirmed_at', query);
  const issued = dateFilter('t.issued_at', query);
  const scans = dateFilter('cl.checked_at', query);
  const paid = dateFilter('p.paid_at', query);
  const refunds = dateFilter('r.completed_at', query);
  // Aggregate each source independently. Joining Payments x Tickets x Logs inflates money.
  const [rows] = await conn.execute<ReportRow[]>(`SELECT e.id, e.name, e.status,
    (SELECT COUNT(*) FROM orders o WHERE o.event_id = e.id AND o.status = 'confirmed' ${orders.sql}) AS confirmedOrders,
    (SELECT COALESCE(SUM(o.total_quantity), 0) FROM orders o WHERE o.event_id = e.id AND o.status = 'confirmed' ${orders.sql}) AS soldTickets,
    (SELECT COUNT(*) FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id JOIN orders o ON o.id = oi.order_id
      WHERE o.event_id = e.id ${issued.sql}) AS issuedTickets,
    (SELECT COUNT(DISTINCT cl.ticket_id) FROM checkin_logs cl WHERE cl.event_id = e.id AND cl.result_code = 'SUCCESS' ${scans.sql}) AS admissions,
    (SELECT COUNT(*) FROM checkin_logs cl WHERE cl.event_id = e.id ${scans.sql}) AS scans,
    (SELECT COUNT(*) FROM checkin_logs cl WHERE cl.event_id = e.id AND cl.result_code <> 'SUCCESS' ${scans.sql}) AS rejectedScans,
    (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE o.event_id = e.id AND p.status = 'success' ${paid.sql}) AS grossRevenue,
    (SELECT COALESCE(SUM(r.amount), 0) FROM refunds r JOIN orders o ON o.id = r.order_id
      WHERE o.event_id = e.id AND r.status = 'completed' ${refunds.sql}) AS refundedAmount
    FROM events e WHERE e.id = ?`, [
    ...orders.values, ...orders.values, ...issued.values, ...scans.values, ...scans.values, ...scans.values,
    ...paid.values, ...refunds.values, query.eventId,
  ]);
  const row = rows[0];
  if (row) row.netRevenue = Math.round((Number(row.grossRevenue) - Number(row.refundedAmount)) * 100) / 100;
  return row;
}
export function logFilter(query: LogQuery) {
  const dates = dateFilter('cl.checked_at', query);
  let sql = `cl.event_id = ?${dates.sql}`;
  const values: (string | number)[] = [query.eventId, ...dates.values];
  if (query.staffId) { sql += ' AND cl.staff_id = ?'; values.push(query.staffId); }
  if (query.result) { sql += ' AND cl.result_code = ?'; values.push(query.result); }
  return { sql, values };
}
export async function countLogs(conn: PoolConnection, query: LogQuery) {
  const filter = logFilter(query);
  const [rows] = await conn.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM checkin_logs cl WHERE ${filter.sql}`, filter.values);
  return Number(rows[0]!.total);
}
export async function logs(conn: PoolConnection, query: LogQuery, limit: number, offset: number) {
  const filter = logFilter(query);
  const [rows] = await conn.query<LogRow[]>(`SELECT cl.id, cl.event_id AS eventId, e.name AS eventName,
    cl.staff_id AS staffId, u.full_name AS staffName, t.ticket_code AS ticketCode,
    cl.result_code AS result, cl.scanned_code_masked AS scannedCode, cl.message, cl.checked_at AS checkedAt
    FROM checkin_logs cl JOIN events e ON e.id = cl.event_id JOIN users u ON u.id = cl.staff_id
    LEFT JOIN tickets t ON t.id = cl.ticket_id
    WHERE ${filter.sql} ORDER BY cl.checked_at DESC, cl.id DESC LIMIT ? OFFSET ?`, [...filter.values, limit, offset]);
  return rows;
}
