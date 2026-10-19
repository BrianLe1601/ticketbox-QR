import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import { AppError } from "../../utils/app-error.js";

export type Queryable = Pick<PoolConnection, "query">;

export interface PlatformSettingsRow extends RowDataPacket {
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_capacity: number | null;
  updated_by: number | null;
  updated_at: Date;
  updated_by_name: string | null;
}

export interface VenueConflictRow extends RowDataPacket {
  id: number;
  name: string;
  status: string;
  checkin_start_at: Date;
  end_time: Date;
}

let schemaReady = false;

/** True when the platform_settings table and categories.kind column exist. */
export async function hasPlatformSchema(): Promise<boolean> {
  if (schemaReady) return true;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = 'platform_settings') AS settingsTable,
       (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'categories' AND column_name = 'kind') AS kindColumn`,
  );
  schemaReady = Number(rows[0]?.settingsTable) === 1 && Number(rows[0]?.kindColumn) === 1;
  return schemaReady;
}

export async function assertPlatformSchema(): Promise<void> {
  if (!await hasPlatformSchema()) {
    throw new AppError(
      503,
      "Database chưa có cấu hình địa điểm và loại danh mục; chạy lại schema trên database thử nghiệm trước khi dùng chức năng này",
      "PLATFORM_SCHEMA_UPGRADE_REQUIRED",
    );
  }
}

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
  } finally {
    conn.release();
  }
}

const settingsSelect = `SELECT ps.venue_name, ps.venue_address, ps.venue_city, ps.venue_capacity,
  ps.updated_by, ps.updated_at, u.full_name AS updated_by_name
  FROM platform_settings ps LEFT JOIN users u ON u.id = ps.updated_by WHERE ps.id = 1`;

export async function readSettings(db: Queryable = pool): Promise<PlatformSettingsRow> {
  const [rows] = await db.query<PlatformSettingsRow[]>(settingsSelect);
  const row = rows[0];
  if (!row) {
    throw new AppError(503, "Thiếu dòng cấu hình nền tảng", "PLATFORM_SETTINGS_MISSING");
  }
  return row;
}

/**
 * Locks the singleton row. It is the first lock of any venue-schedule change
 * (before the Event row) so concurrent Admins are serialized.
 */
export async function lockSettings(conn: PoolConnection): Promise<PlatformSettingsRow> {
  await conn.query("SELECT id FROM platform_settings WHERE id = 1 FOR UPDATE");
  return readSettings(conn);
}

export async function writeVenue(
  conn: PoolConnection,
  adminId: number,
  venue: { name: string; address: string; city: string; capacity: number },
) {
  await conn.query(
    `UPDATE platform_settings SET venue_name = ?, venue_address = ?, venue_city = ?,
       venue_capacity = ?, updated_by = ? WHERE id = 1`,
    [venue.name, venue.address, venue.city, venue.capacity, adminId],
  );
}

/** Draft/published Events whose venue snapshot differs from the current venue. */
export async function countOutOfSyncEvents(db: Queryable = pool): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM events e CROSS JOIN platform_settings ps
      WHERE ps.id = 1 AND ps.venue_name IS NOT NULL
        AND e.status IN ('draft', 'published')
        AND (e.venue <> ps.venue_name OR e.address <> ps.venue_address
          OR e.city <> ps.venue_city OR e.venue_capacity <> ps.venue_capacity)`,
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * The single venue is occupied over [checkin_start_at, end_time]. Boundaries are
 * closed, so touching Events conflict, and only cancelled Events free the venue.
 * Times are database-local (UTC+07) strings, as produced by toDatabaseDate.
 */
export async function findVenueConflict(
  conn: PoolConnection,
  interval: { checkinStart: string; end: string },
  excludeEventId: number | null,
): Promise<VenueConflictRow | null> {
  const [rows] = await conn.query<VenueConflictRow[]>(
    `SELECT id, name, status, checkin_start_at, end_time FROM events
      WHERE status <> 'cancelled' AND (? IS NULL OR id <> ?)
        AND checkin_start_at <= ? AND end_time >= ?
      ORDER BY checkin_start_at, id LIMIT 1 FOR SHARE`,
    [excludeEventId, excludeEventId, interval.end, interval.checkinStart],
  );
  return rows[0] ?? null;
}
