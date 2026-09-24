import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";

import { pool } from "../database/pool.js";
import { AppError } from "../utils/app-error.js";

export async function requireStaffSchema(_req: Request, _res: Response, next: NextFunction) {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS columnCount FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'
         AND (column_name IN ('google_sub', 'staff_approval_status', 'staff_reviewed_by', 'staff_reviewed_at')
           OR (column_name = 'password_hash' AND is_nullable = 'YES'))`,
    );
    if (Number(rows[0]?.columnCount) !== 5) {
      throw new AppError(503,
        "Database chưa có schema Google Staff; không chạy script reset trên dữ liệu thật",
        "STAFF_SCHEMA_UPGRADE_REQUIRED");
    }
    next();
  } catch (error) { next(error); }
}
