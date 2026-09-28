import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/pool.js';
import type { ResultCode } from './checkin.types.js';
import type { AssignmentListQuery, AssignmentLogsQuery } from './checkin.schema.js';

export interface EventRow extends RowDataPacket {
  id: number; name: string; venue: string; startTime: Date; status: string;
  checkinStartAt: Date; checkinEndAt: Date;
}
export interface TicketRow extends RowDataPacket {
  id: number; orderId: number; eventId: number; code: string;
  holderName: string | null; status: string; checkedInAt: Date | null;
}
export interface AssignmentRow extends EventRow {
  assignmentId: number; assignedAt: Date; revokedAt: Date | null; isActive: number;
  address: string; city: string; endTime: Date; operationalState: AssignmentOperationalState;
}
export interface AssignmentLogRow extends RowDataPacket {
  id: number; code: ResultCode; scannedCode: string; message: string; checkedAt: Date;
}
export type AssignmentOperationalState = 'checkin_open' | 'upcoming' | 'preparing' | 'checkin_closed' | 'completed' | 'cancelled' | 'revoked';
const eventColumns = `e.id, e.name, e.venue, e.start_time AS startTime, e.status,
  e.checkin_start_at AS checkinStartAt, e.checkin_end_at AS checkinEndAt`;
const assignmentColumns = `es.id AS assignmentId, ${eventColumns}, e.address, e.city, e.end_time AS endTime,
  es.assigned_at AS assignedAt, es.revoked_at AS revokedAt, es.is_active AS isActive,
  CASE
    WHEN es.is_active = FALSE OR es.revoked_at IS NOT NULL THEN 'revoked'
    WHEN e.status = 'cancelled' THEN 'cancelled'
    WHEN e.status = 'completed' OR e.end_time <= NOW(3) THEN 'completed'
    WHEN e.status = 'draft' AND e.checkin_end_at >= NOW(3) THEN 'preparing'
    WHEN e.status IN ('published', 'ongoing') AND NOW(3) BETWEEN e.checkin_start_at AND e.checkin_end_at THEN 'checkin_open'
    WHEN e.status IN ('published', 'ongoing') AND NOW(3) < e.checkin_start_at THEN 'upcoming'
    ELSE 'checkin_closed'
  END AS operationalState`;

export async function transaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const value = await work(conn);
    await conn.commit();
    return value;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}
export async function listEvents(staffId: number) {
  const [rows] = await pool.execute<EventRow[]>(`SELECT ${eventColumns} FROM events e
    JOIN event_staff es ON es.event_id = e.id
    WHERE es.staff_id = ? AND es.is_active = TRUE AND es.revoked_at IS NULL
      AND e.status IN ('published', 'ongoing') AND e.end_time > NOW(3)
      AND NOW(3) BETWEEN e.checkin_start_at AND e.checkin_end_at
    ORDER BY e.start_time ASC, e.id ASC`, [staffId]);
  return rows;
}

function assignmentSegmentCondition(segment: AssignmentListQuery['segment']) {
  switch (segment) {
    case 'open':
      return `es.is_active = TRUE AND es.revoked_at IS NULL AND e.status IN ('published', 'ongoing')
        AND e.end_time > NOW(3) AND NOW(3) BETWEEN e.checkin_start_at AND e.checkin_end_at`;
    case 'upcoming':
      return `es.is_active = TRUE AND es.revoked_at IS NULL AND e.end_time > NOW(3)
        AND ((e.status = 'draft' AND e.checkin_end_at >= NOW(3))
          OR (e.status IN ('published', 'ongoing') AND NOW(3) < e.checkin_start_at))`;
    case 'history':
      return `(es.is_active = FALSE OR es.revoked_at IS NOT NULL OR e.status IN ('completed', 'cancelled')
        OR e.end_time <= NOW(3) OR (e.status = 'draft' AND e.checkin_end_at < NOW(3))
        OR (e.status IN ('published', 'ongoing') AND e.checkin_end_at < NOW(3)))`;
    default:
      return '1 = 1';
  }
}

export async function listAssignments(staffId: number, query: AssignmentListQuery) {
  const condition = assignmentSegmentCondition(query.segment);
  const offset = (query.page - 1) * query.limit;
  const orderBy = query.segment === 'upcoming'
    ? 'e.checkin_start_at ASC, es.id ASC'
    : `CASE WHEN es.is_active = TRUE AND es.revoked_at IS NULL THEN 0 ELSE 1 END,
      e.start_time DESC, es.id DESC`;
  // mysql2 server-side prepared statements reject LIMIT/OFFSET placeholders on
  // the MySQL variant used by this project. query() safely formats the already
  // validated integer values and keeps every user-controlled filter parameterized.
  const [rows] = await pool.query<AssignmentRow[]>(`SELECT ${assignmentColumns}
    FROM event_staff es JOIN events e ON e.id = es.event_id
    WHERE es.staff_id = ? AND ${condition}
    ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [staffId, query.limit, offset]);
  const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total
    FROM event_staff es JOIN events e ON e.id = es.event_id
    WHERE es.staff_id = ? AND ${condition}`, [staffId]);
  return { rows, total: Number(countRows[0]?.total ?? 0) };
}

export async function findAssignment(staffId: number, assignmentId: number) {
  const [rows] = await pool.execute<AssignmentRow[]>(`SELECT ${assignmentColumns}
    FROM event_staff es JOIN events e ON e.id = es.event_id
    WHERE es.id = ? AND es.staff_id = ? LIMIT 1`, [assignmentId, staffId]);
  return rows[0];
}

export async function assignmentLogCount(staffId: number, assignmentId: number, query: AssignmentLogsQuery) {
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total
    FROM checkin_logs cl JOIN event_staff es ON es.event_id = cl.event_id AND es.staff_id = cl.staff_id
    WHERE es.id = ? AND es.staff_id = ? AND cl.checked_at >= es.assigned_at
      AND (es.revoked_at IS NULL OR cl.checked_at <= es.revoked_at)
      AND (? IS NULL OR cl.result_code = ?)`, [assignmentId, staffId, query.result ?? null, query.result ?? null]);
  return Number(rows[0]?.total ?? 0);
}

export async function assignmentLogs(staffId: number, assignmentId: number, query: AssignmentLogsQuery) {
  const offset = (query.page - 1) * query.limit;
  const [rows] = await pool.query<AssignmentLogRow[]>(`SELECT cl.id, cl.result_code AS code,
    cl.scanned_code_masked AS scannedCode, cl.message, cl.checked_at AS checkedAt
    FROM checkin_logs cl JOIN event_staff es ON es.event_id = cl.event_id AND es.staff_id = cl.staff_id
    WHERE es.id = ? AND es.staff_id = ? AND cl.checked_at >= es.assigned_at
      AND (es.revoked_at IS NULL OR cl.checked_at <= es.revoked_at)
      AND (? IS NULL OR cl.result_code = ?)
    ORDER BY cl.checked_at DESC, cl.id DESC LIMIT ? OFFSET ?`,
  [assignmentId, staffId, query.result ?? null, query.result ?? null, query.limit, offset]);
  return rows;
}
export async function lockEvent(conn: PoolConnection, eventId: number) {
  const [rows] = await conn.execute<EventRow[]>(`SELECT ${eventColumns} FROM events e WHERE e.id = ? FOR UPDATE`, [eventId]);
  return rows[0];
}
export async function hasAssignment(conn: PoolConnection, eventId: number, staffId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>(`SELECT id FROM event_staff
    WHERE event_id = ? AND staff_id = ? AND is_active = TRUE AND revoked_at IS NULL FOR UPDATE`, [eventId, staffId]);
  return rows.length > 0;
}
export async function findTicket(conn: PoolConnection, value: string, isQr: boolean) {
  const [rows] = await conn.execute<TicketRow[]>(`SELECT t.id, oi.order_id AS orderId,
    o.event_id AS eventId, t.ticket_code AS code, t.holder_name AS holderName,
    t.status, t.checked_in_at AS checkedInAt FROM tickets t
    JOIN order_items oi ON oi.id = t.order_item_id JOIN orders o ON o.id = oi.order_id
    WHERE ${isQr ? 't.qr_token_hash' : 't.ticket_code'} = ?`, [value]);
  return rows[0];
}
export async function lockOrder(conn: PoolConnection, orderId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>('SELECT status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  return rows[0]?.status as string | undefined;
}
export async function lockTicket(conn: PoolConnection, ticketId: number) {
  const [rows] = await conn.execute<TicketRow[]>(`SELECT id, ticket_code AS code,
    holder_name AS holderName, status, checked_in_at AS checkedInAt FROM tickets WHERE id = ? FOR UPDATE`, [ticketId]);
  return rows[0];
}
export async function databaseNow(conn: PoolConnection): Promise<Date> {
  const [rows] = await conn.query<RowDataPacket[]>('SELECT CURRENT_TIMESTAMP(3) AS now');
  return rows[0]!.now as Date;
}
export async function markCheckedIn(conn: PoolConnection, ticketId: number, staffId: number, now: Date) {
  const [result] = await conn.execute<ResultSetHeader>(`UPDATE tickets SET status = 'checked_in',
    checked_in_at = ?, checked_in_by = ? WHERE id = ? AND status = 'issued'`, [now, staffId, ticketId]);
  return result.affectedRows === 1;
}
export async function appendLog(conn: PoolConnection, input: {
  eventId: number; staffId: number; ticketId: number | null; code: ResultCode;
  hash: string; masked: string; message: string; now: Date;
}) {
  await conn.execute(`INSERT INTO checkin_logs
    (event_id, staff_id, ticket_id, result_code, scanned_code_hash, scanned_code_masked, message, checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [input.eventId, input.staffId, input.ticketId, input.code, input.hash, input.masked, input.message, input.now]);
}
export async function recentLogs(conn: PoolConnection, eventId: number, staffId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>(`SELECT id, result_code AS code,
    scanned_code_masked AS scannedCode, message, checked_at AS checkedAt
    FROM checkin_logs WHERE event_id = ? AND staff_id = ? ORDER BY checked_at DESC, id DESC LIMIT 20`, [eventId, staffId]);
  return rows;
}
