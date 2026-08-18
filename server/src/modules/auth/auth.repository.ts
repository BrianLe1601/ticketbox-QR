import type { RowDataPacket } from "mysql2";

import { pool } from "../../database/pool.js";

export interface AuthUserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: "admin" | "staff";
  is_active: 0 | 1;
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