import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "../../database/pool.js";

export interface StaffRow extends RowDataPacket {
  id: number;
  fullName: string;
  email: string;
  isActive: 0 | 1;
  approvalStatus: "pending" | "approved" | "rejected";
  reviewedAt: Date | null;
  reviewedBy: number | null;
  createdAt: Date;
}

export interface AssignmentRow extends RowDataPacket {
  id: number;
  staffId: number;
  eventId: number;
  eventName: string;
  eventStatus: string;
  startTime: Date;
  endTime: Date;
  assignedAt: Date;
  assignedBy: number;
  revokedAt: Date | null;
  isActive: 0 | 1;
}

export async function listStaffRows(): Promise<StaffRow[]> {
  const [rows] = await pool.execute<StaffRow[]>(
    `SELECT id, full_name AS fullName, email, is_active AS isActive,
      staff_approval_status AS approvalStatus, staff_reviewed_at AS reviewedAt,
      staff_reviewed_by AS reviewedBy, created_at AS createdAt
     FROM users WHERE role = 'staff' ORDER BY created_at DESC, id DESC`,
  );
  return rows;
}

export async function listAssignmentRows(): Promise<AssignmentRow[]> {
  const [rows] = await pool.execute<AssignmentRow[]>(
    `SELECT es.id, es.staff_id AS staffId, es.event_id AS eventId,
      e.name AS eventName, e.status AS eventStatus, e.start_time AS startTime,
      e.end_time AS endTime, es.assigned_at AS assignedAt,
      es.assigned_by AS assignedBy, es.revoked_at AS revokedAt,
      es.is_active AS isActive
     FROM event_staff es JOIN events e ON e.id = es.event_id
     JOIN users u ON u.id = es.staff_id AND u.role = 'staff'
     ORDER BY es.assigned_at DESC, es.id DESC`,
  );
  return rows;
}

export async function withStaffTransaction<T>(work: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

export async function lockStaff(conn: PoolConnection, staffId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT id, is_active AS isActive, staff_approval_status AS approvalStatus
     FROM users WHERE id = ? AND role = 'staff' FOR UPDATE`, [staffId],
  );
  return rows[0] as { id: number; isActive: 0 | 1;
    approvalStatus: "pending" | "approved" | "rejected" } | undefined;
}

export async function lockEvent(conn: PoolConnection, eventId: number) {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT id, status, end_time AS endTime FROM events WHERE id = ? FOR UPDATE`, [eventId],
  );
  return rows[0] as { id: number; status: string; endTime: Date } | undefined;
}

export async function revokeAllAssignments(conn: PoolConnection, staffId: number) {
  await conn.execute(
    `UPDATE event_staff SET is_active = FALSE, revoked_at = NOW(3)
     WHERE staff_id = ? AND is_active = TRUE`, [staffId],
  );
}

export async function revokeAllSessions(conn: PoolConnection, staffId: number) {
  await conn.execute(
    `UPDATE auth_sessions SET revoked_at = NOW(3)
     WHERE user_id = ? AND revoked_at IS NULL`, [staffId],
  );
}
