import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../database/pool.js';

export async function findConfirmedOrdersByEmail(email: string) {
    const [rows] = await pool.query<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM orders WHERE buyer_email = ? AND status = 'confirmed' ORDER BY id", [email]);
    return rows;
}
