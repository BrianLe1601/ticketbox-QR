import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { pool } from "../../database/pool.js";

export interface EventLifecycleSyncResult {
  started: number;
  completed: number;
  changes: EventLifecycleChange[];
}

export interface EventLifecycleChange {
  eventId: number;
  status: "ongoing" | "completed";
}

interface EventIdRow extends RowDataPacket {
  id: number;
}

/**
 * Advance persisted Event lifecycle state in one transaction. The two ordered
 * updates also handle a published Event whose whole schedule elapsed while the
 * server was offline: published -> ongoing -> completed.
 */
export async function advanceEventLifecycle(): Promise<EventLifecycleSyncResult> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [startingEvents] = await connection.execute<EventIdRow[]>(
      `SELECT id
       FROM events
       WHERE status = 'published' AND start_time <= NOW(3)
       ORDER BY id
       FOR UPDATE`,
    );
    const [started] = await connection.execute<ResultSetHeader>(
      `UPDATE events
       SET status = 'ongoing'
       WHERE status = 'published' AND start_time <= NOW(3)`,
    );
    const [completingEvents] = await connection.execute<EventIdRow[]>(
      `SELECT id
       FROM events
       WHERE status = 'ongoing' AND end_time <= NOW(3)
       ORDER BY id
       FOR UPDATE`,
    );
    const [completed] = await connection.execute<ResultSetHeader>(
      `UPDATE events
       SET status = 'completed', completed_at = end_time
       WHERE status = 'ongoing' AND end_time <= NOW(3)`,
    );
    await connection.commit();

    const changes = new Map<number, EventLifecycleChange["status"]>();
    for (const event of startingEvents) changes.set(event.id, "ongoing");
    for (const event of completingEvents) changes.set(event.id, "completed");

    return {
      started: started.affectedRows,
      completed: completed.affectedRows,
      changes: [...changes].map(([eventId, status]) => ({ eventId, status })),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
