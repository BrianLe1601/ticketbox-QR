import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool } from '../src/database/pool.js';
import { encryptQrToken } from '../src/services/qr-encryption.service.js';

describe('ticket credential guards (disposable MySQL)', () => {
    beforeAll(() => {
        if (!process.env.DB_NAME?.startsWith('ticketboxqr_test_')) throw new Error('Requires a disposable ticketboxqr_test_ database');
    });
    afterAll(async () => { await pool.end(); });
    async function fixture(check: (conn: PoolConnection, ticket: RowDataPacket) => Promise<void>) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(`SELECT t.* FROM tickets t
                JOIN order_items oi ON oi.id=t.order_item_id JOIN orders o ON o.id=oi.order_id
                JOIN events e ON e.id=o.event_id JOIN categories c ON c.id=e.category_id
                WHERE c.slug='qa-workflow' AND t.status='issued' AND t.qr_token_encrypted IS NULL
                ORDER BY t.id LIMIT 1 FOR UPDATE`);
            if (!rows[0]) throw new Error('Run seed:workflows before integration tests');
            await check(conn, rows[0]);
        } finally { await conn.rollback(); conn.release(); }
    }
    it('allows NULL, one initial ciphertext and identical updates; blocks overwrite and removal', async () => {
        await fixture(async (conn, ticket) => {
            await conn.query('UPDATE tickets SET qr_token_encrypted=NULL WHERE id=?', [ticket.id]);
            const envelope = encryptQrToken('ab'.repeat(32), ticket.ticket_code);
            await conn.query('UPDATE tickets SET qr_token_encrypted=? WHERE id=?', [envelope, ticket.id]);
            await conn.query('UPDATE tickets SET qr_token_encrypted=? WHERE id=?', [envelope, ticket.id]);
            for (const value of [null, encryptQrToken('ab'.repeat(32), ticket.ticket_code)]) {
                await expect(conn.query('UPDATE tickets SET qr_token_encrypted=? WHERE id=?', [value, ticket.id]))
                    .rejects.toThrow('QR credential is immutable once encrypted');
            }
        });
    });
    it('still rejects hash and identity changes', async () => {
        await fixture(async (conn, ticket) => {
            for (const expression of ["qr_token_hash=REPEAT('f',64)", "ticket_code=CONCAT(ticket_code,'X')", 'issued_at=DATE_ADD(issued_at, INTERVAL 1 SECOND)', 'created_at=DATE_ADD(created_at, INTERVAL 1 SECOND)']) {
                await expect(conn.query(`UPDATE tickets SET ${expression} WHERE id=?`, [ticket.id])).rejects.toThrow();
            }
        });
    });
});
