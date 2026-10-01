import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { pool } from "../../database/pool.js";

export interface AuthUserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string | null;
  role: "admin" | "staff";
  is_active: 0 | 1;
}

export interface GoogleStaffRow extends AuthUserRow {
  google_sub: string;
  staff_approval_status: "pending" | "approved" | "rejected";
}

export async function findUserByEmail(
  email: string,
): Promise<AuthUserRow | null> {
  const [rows] = await pool.execute<AuthUserRow[]>(
    `
      SELECT
        id,
        full_name,
        email,
        password_hash,
        role,
        is_active
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  return rows[0] ?? null;
}

export async function findActiveUserById(
  id: number,
): Promise<AuthUserRow | null> {
  const [rows] = await pool.execute<AuthUserRow[]>(
    `
      SELECT
        id,
        full_name,
        email,
        password_hash,
        role,
        is_active
      FROM users
      WHERE id = ?
        AND is_active = TRUE
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ?? null;
}

export async function findGoogleStaffBySub(sub: string): Promise<GoogleStaffRow | null> {
  const [rows] = await pool.execute<GoogleStaffRow[]>(
    `SELECT id, full_name, email, password_hash, google_sub, staff_approval_status,
            role, is_active FROM users WHERE google_sub = ? AND role = 'staff' LIMIT 1`,
    [sub],
  );
  return rows[0] ?? null;
}

export async function registerPendingGoogleStaff(input: {
  sub: string; email: string; name: string;
}): Promise<GoogleStaffRow | null> {
  // A duplicate subject is an idempotent sign-in; a duplicate email owned by a
  // different identity must never be linked automatically.
  await pool.execute(
    `INSERT INTO users (full_name, email, password_hash, google_sub, role,
      is_active, staff_approval_status)
     VALUES (?, ?, NULL, ?, 'staff', FALSE, 'pending')
     ON DUPLICATE KEY UPDATE id = id`,
    [input.name, input.email, input.sub],
  );
  return findGoogleStaffBySub(input.sub);
}

export async function updateAdminFullName(id: number, fullName: string): Promise<AuthUserRow | null> {
  await pool.execute(
    `UPDATE users SET full_name = ? WHERE id = ? AND role = 'admin' AND is_active = TRUE`,
    [fullName, id],
  );
  const [rows] = await pool.execute<AuthUserRow[]>(
    `SELECT id, full_name, email, password_hash, role, is_active
     FROM users WHERE id = ? AND role = 'admin' AND is_active = TRUE LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function transaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function lockActiveAdmin(connection: PoolConnection, id: number): Promise<AuthUserRow | null> {
  const [rows] = await connection.execute<AuthUserRow[]>(
    `SELECT id, full_name, email, password_hash, role, is_active
     FROM users WHERE id = ? AND role = 'admin' AND is_active = TRUE FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

export async function replacePasswordAndRevokeSessions(
  connection: PoolConnection,
  userId: number,
  passwordHash: string,
) {
  await connection.execute(`UPDATE users SET password_hash = ? WHERE id = ? AND role = 'admin'`, [passwordHash, userId]);
  await connection.execute(
    `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW(3)) WHERE user_id = ?`,
    [userId],
  );
}
