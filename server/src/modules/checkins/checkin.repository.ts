import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/pool.js';
import type { ResultCode } from './checkin.types.js';

export interface EventRow extends RowDataPacket {
  id: number; name: string; venue: string; startTime: Date; status: string;
  checkinStartAt: Date; checkinEndAt: Date;
}
export interface TicketRow extends RowDataPacket {
  id: number; orderId: number; eventId: number; code: string;
  holderName: string | null; status: string; checkedInAt: Date | null;
}
const eventColumns = `e.id, e.name, e.venue, e.start_time AS startTime, e.status,
  e.checkin_start_at AS checkinStartAt, e.checkin_end_at AS checkinEndAt`;

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
    ORDER BY e.start_time DESC, e.id DESC`, [staffId]);
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
