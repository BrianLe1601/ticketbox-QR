import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/pool.js';

export async function findConfirmedOrdersByEmail(email: string) {
    const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
        `SELECT o.id
         FROM orders o
         JOIN events e ON e.id = o.event_id
         WHERE o.buyer_email = ?
           AND o.status = 'confirmed'
           AND e.status IN ('published', 'ongoing')
           AND e.end_time > NOW(3)
           AND EXISTS (
             SELECT 1
             FROM order_items oi
             JOIN tickets t ON t.order_item_id = oi.id
             WHERE oi.order_id = o.id AND t.status = 'issued'
           )
         ORDER BY o.id`, [email]);
    return rows;
}
