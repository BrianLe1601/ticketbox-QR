import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const emailVerificationMocks = vi.hoisted(() => ({
    assertEmailVerified: vi.fn(),
    consumeEmailVerification: vi.fn(),
}));

vi.mock('../src/services/email-verification.service.js', () => ({
    ...emailVerificationMocks,
    requestEmailVerification: vi.fn(),
    confirmEmailVerification: vi.fn(),
}));
vi.mock('../src/services/qr.service.js', () => ({
    createTicketQrDataUrl: vi.fn(async () => 'data:image/png;base64,dGVzdA=='),
}));
vi.mock('../src/services/mail.service.js', () => ({
    sendTicketEmail: vi.fn(async () => ({ messageId: 'week4-test-message' })),
}));

import { app } from '../src/app.js';
import { pool } from '../src/database/pool.js';
import {
    createOrder,
    expireOrderIfNeeded,
    getOrderByLookupToken,
    payOrder,
} from '../src/modules/checkout/checkout.service.js';
import type { CreateOrderBody } from '../src/modules/checkout/checkout.schema.js';

interface TestEvent {
    eventId: number;
    ticketTypeId: number;
}

interface CountRow extends RowDataPacket {
    count: number;
}

interface InventoryRow extends RowDataPacket {
    reserved_quantity: number;
    sold_quantity: number;
}

const runId = `w4-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const eventIds: number[] = [];
let adminId: number;
let categoryId: number;

function makeKey(label: string) {
    return `${runId}:${label}`;
}

function makeBody(testEvent: TestEvent, quantity = 1): CreateOrderBody {
    return {
        eventId: testEvent.eventId,
        emailVerificationToken: `${runId}-verified`,
        items: [{ ticketTypeId: testEvent.ticketTypeId, quantity }],
        buyer: {
            name: 'Week 4 Tester',
            email: 'week4.tester@gmail.com',
            phone: '0900000000',
        },
    };
}

async function createSellableEvent(label: string, capacity: number): Promise<TestEvent> {
    const slug = `${runId}-${label}`.replace(/[^a-z0-9-]/g, '-');
    const [eventResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO events
            (name, slug, description, category_id, venue, address, city,
             venue_capacity, cover_image_url, cover_image_alt,
             start_time, end_time, sales_start_at, sales_end_at,
             checkin_start_at, checkin_end_at, created_by)
         VALUES (?, ?, 'Week 4 integration fixture', ?, 'Test Venue', '1 Test Street', 'HCM',
                 ?, NULL, 'Week 4 fixture',
                 DATE_ADD(DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY), INTERVAL 18 HOUR),
                 DATE_ADD(DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY), INTERVAL 22 HOUR),
                 DATE_SUB(NOW(3), INTERVAL 1 DAY),
                 DATE_ADD(DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY), INTERVAL 17 HOUR),
                 DATE_ADD(DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY), INTERVAL 17 HOUR),
                 DATE_ADD(DATE_ADD(CURRENT_DATE(), INTERVAL 2 DAY), INTERVAL 22 HOUR), ?)`,
        [`Week 4 ${label}`, slug, categoryId, capacity, adminId]
    );
    const eventId = eventResult.insertId;
    eventIds.push(eventId);

    const [ticketResult] = await pool.query<ResultSetHeader>(
        `INSERT INTO ticket_types
            (event_id, name, price, capacity, max_per_order, is_active)
         VALUES (?, 'General', 100000, ?, ?, TRUE)`,
        [eventId, capacity, Math.max(capacity, 1)]
    );
    await pool.query(
        `UPDATE events SET status = 'published', published_at = NOW(3) WHERE id = ?`,
        [eventId]
    );
    return { eventId, ticketTypeId: ticketResult.insertId };
}

async function countOrdersForEvent(eventId: number) {
    const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) AS count FROM orders WHERE event_id = ?`,
        [eventId]
    );
    return Number(rows[0]?.count ?? 0);
}

async function inventory(ticketTypeId: number) {
    const [rows] = await pool.query<InventoryRow[]>(
        `SELECT reserved_quantity, sold_quantity FROM ticket_types WHERE id = ?`,
        [ticketTypeId]
    );
    return rows[0];
}

describe.sequential('Week 4 checkout safety integration', () => {
    beforeAll(async () => {
        const [adminResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO users (full_name, email, password_hash, role, is_active)
             VALUES ('Week 4 Test Admin', ?, 'not-used-by-integration-test', 'admin', TRUE)`,
            [`${runId}@ticketbox.local`]
        );
        adminId = adminResult.insertId;

        const [categoryResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO categories (name, slug, description, sort_order)
             VALUES (?, ?, 'Week 4 integration fixture', 9999)`,
            [`Week 4 ${runId}`, `${runId}-category`]
        );
        categoryId = categoryResult.insertId;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterAll(async () => {
        if (eventIds.length > 0) {
            const placeholders = eventIds.map(() => '?').join(', ');
            await pool.query(`DELETE cl FROM checkin_logs cl WHERE cl.event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE el FROM email_logs el JOIN orders o ON o.id = el.order_id WHERE o.event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE r FROM refunds r JOIN orders o ON o.id = r.order_id WHERE o.event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE p FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE t FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id JOIN orders o ON o.id = oi.order_id WHERE o.event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE oi FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE FROM orders WHERE event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE FROM event_staff WHERE event_id IN (${placeholders})`, eventIds);
            await pool.query(
                `UPDATE events
                 SET visibility = 'hidden', hidden_at = NOW(3),
                     hidden_reason = 'Week 4 test cleanup', hidden_by = ?
                 WHERE id IN (${placeholders})`,
                [adminId, ...eventIds]
            );
            await pool.query(`DELETE FROM ticket_types WHERE event_id IN (${placeholders})`, eventIds);
            await pool.query(`DELETE FROM events WHERE id IN (${placeholders})`, eventIds);
        }
        if (categoryId) await pool.query(`DELETE FROM categories WHERE id = ?`, [categoryId]);
        if (adminId) await pool.query(`DELETE FROM users WHERE id = ?`, [adminId]);
        await pool.end();
    });

    it('rejects a missing idempotency key and duplicate ticket types at the API boundary', async () => {
        const fixture = await createSellableEvent('api-validation', 2);
        const body = makeBody(fixture);

        const missingKey = await request(app).post('/api/checkout/orders').send(body);
        expect(missingKey.status).toBe(400);
        expect(missingKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

        const invalidKey = await request(app)
            .post('/api/checkout/orders')
            .set('Idempotency-Key', 'too-short')
            .send(body);
        expect(invalidKey.status).toBe(400);
        expect(invalidKey.body.code).toBe('INVALID_IDEMPOTENCY_KEY');

        const duplicateItem = await request(app)
            .post('/api/checkout/orders')
            .set('Idempotency-Key', makeKey('duplicate-api'))
            .send({ ...body, items: [body.items[0], body.items[0]] });
        expect(duplicateItem.status).toBe(400);
        expect(duplicateItem.body.message).toContain('Mỗi loại vé chỉ được xuất hiện một lần');
        expect(await countOrdersForEvent(fixture.eventId)).toBe(0);
    });

    it('returns the same order on retry and reserves inventory exactly once', async () => {
        const fixture = await createSellableEvent('idempotent-retry', 5);
        const body = makeBody(fixture, 2);
        const key = makeKey('same-request');

        const first = await createOrder(body, key);
        const retry = await createOrder({ ...body, emailVerificationToken: 'already-consumed-token' }, key);
        const lookupToken = first.lookupToken;
        expect(lookupToken).toBeDefined();

        expect(retry.id).toBe(first.id);
        expect(retry.lookupToken).toBe(first.lookupToken);
        expect(await countOrdersForEvent(fixture.eventId)).toBe(1);
        expect((await inventory(fixture.ticketTypeId))?.reserved_quantity).toBe(2);
        expect(emailVerificationMocks.assertEmailVerified).toHaveBeenCalledTimes(1);
        expect(emailVerificationMocks.consumeEmailVerification).toHaveBeenCalledTimes(1);

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT lookup_token_hash FROM orders WHERE id = ?`,
            [first.id]
        );
        const storedHash = String(rows[0]?.lookup_token_hash);
        expect(storedHash).toMatch(/^[a-f0-9]{64}$/);
        expect(storedHash).not.toBe(lookupToken);
        expect(storedHash).toBe(crypto.createHash('sha256').update(lookupToken!).digest('hex'));

        const lookedUp = await getOrderByLookupToken(first.id, lookupToken!);
        expect(lookedUp.id).toBe(first.id);
        expect(lookedUp.lookupToken).toBeUndefined();
        await expect(getOrderByLookupToken(first.id, 'wrong-token')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns 409 when one idempotency key is reused with another payload', async () => {
        const fixture = await createSellableEvent('idempotency-conflict', 5);
        const otherFixture = await createSellableEvent('idempotency-other-event', 5);
        const body = makeBody(fixture, 1);
        const key = makeKey('conflict');
        await createOrder(body, key);

        await expect(createOrder({
            ...body,
            items: [{ ticketTypeId: fixture.ticketTypeId, quantity: 2 }],
        }, key))
            .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' });
        expect(await countOrdersForEvent(fixture.eventId)).toBe(1);
        expect((await inventory(fixture.ticketTypeId))?.reserved_quantity).toBe(1);

        await expect(createOrder(makeBody(otherFixture), key))
            .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' });
        expect(await countOrdersForEvent(otherFixture.eventId)).toBe(0);
        expect((await inventory(otherFixture.ticketTypeId))?.reserved_quantity).toBe(0);
    });

    it('rolls back all rows and inventory when an order item insert fails midway', async () => {
        const fixture = await createSellableEvent('rollback', 5);
        const body = makeBody(fixture, 1);
        const invalidDuplicateBody = {
            ...body,
            items: [body.items[0], body.items[0]],
        } as CreateOrderBody;

        await expect(createOrder(invalidDuplicateBody, makeKey('rollback'))).rejects.toBeTruthy();
        expect(await countOrdersForEvent(fixture.eventId)).toBe(0);
        expect((await inventory(fixture.ticketTypeId))?.reserved_quantity).toBe(0);
    });

    it('serializes concurrent reservations so the last ticket cannot be oversold', async () => {
        const fixture = await createSellableEvent('no-oversell', 1);
        const body = makeBody(fixture, 1);

        const results = await Promise.allSettled([
            createOrder(body, makeKey('race-a')),
            createOrder(body, makeKey('race-b')),
        ]);
        const successes = results.filter((result) => result.status === 'fulfilled');
        const failures = results.filter((result) => result.status === 'rejected');

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'SOLD_OUT' });
        expect(await countOrdersForEvent(fixture.eventId)).toBe(1);
        expect(await inventory(fixture.ticketTypeId)).toMatchObject({ reserved_quantity: 1, sold_quantity: 0 });
    });

    it('releases an expired reservation exactly once under concurrent expiry attempts', async () => {
        const fixture = await createSellableEvent('expiry', 3);
        const order = await createOrder(makeBody(fixture, 2), makeKey('expiry'));
        await pool.query(`UPDATE orders SET expires_at = DATE_SUB(NOW(3), INTERVAL 1 SECOND) WHERE id = ?`, [order.id]);

        await Promise.all([expireOrderIfNeeded(order.id), expireOrderIfNeeded(order.id)]);
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT status, expired_at FROM orders WHERE id = ?`, [order.id]);
        expect(rows[0]?.status).toBe('expired');
        expect(rows[0]?.expired_at).toBeTruthy();
        expect(await inventory(fixture.ticketTypeId)).toMatchObject({ reserved_quantity: 0, sold_quantity: 0 });

        await expireOrderIfNeeded(order.id);
        expect((await inventory(fixture.ticketTypeId))?.reserved_quantity).toBe(0);
    });

    it('rejects payment for an expired order and commits the inventory release', async () => {
        const fixture = await createSellableEvent('expired-payment', 2);
        const order = await createOrder(makeBody(fixture, 2), makeKey('expired-payment'));
        const lookupToken = order.lookupToken;
        expect(lookupToken).toBeDefined();
        await pool.query(`UPDATE orders SET expires_at = DATE_SUB(NOW(3), INTERVAL 1 SECOND) WHERE id = ?`, [order.id]);

        await expect(payOrder(order.id, lookupToken!))
            .rejects.toMatchObject({ code: 'ORDER_EXPIRED' });
        const [orderRows] = await pool.query<RowDataPacket[]>(`SELECT status FROM orders WHERE id = ?`, [order.id]);
        const [paymentRows] = await pool.query<CountRow[]>(`SELECT COUNT(*) AS count FROM payments WHERE order_id = ?`, [order.id]);
        expect(orderRows[0]?.status).toBe('expired');
        expect(await inventory(fixture.ticketTypeId)).toMatchObject({ reserved_quantity: 0, sold_quantity: 0 });
        expect(Number(paymentRows[0]?.count)).toBe(0);
    });

    it('settles payment once and rejects a payment retry without double-selling', async () => {
        const fixture = await createSellableEvent('payment', 3);
        const order = await createOrder(makeBody(fixture, 2), makeKey('payment'));
        const lookupToken = order.lookupToken;
        expect(lookupToken).toBeDefined();

        const paid = await payOrder(order.id, lookupToken!);
        expect(paid.status).toBe('confirmed');
        expect(paid.tickets).toHaveLength(2);
        await expect(payOrder(order.id, lookupToken!))
            .rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE' });

        expect(await inventory(fixture.ticketTypeId)).toMatchObject({ reserved_quantity: 0, sold_quantity: 2 });
        const [paymentRows] = await pool.query<CountRow[]>(`SELECT COUNT(*) AS count FROM payments WHERE order_id = ?`, [order.id]);
        const [ticketRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS count FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id WHERE oi.order_id = ?`,
            [order.id]
        );
        expect(Number(paymentRows[0]?.count)).toBe(1);
        expect(Number(ticketRows[0]?.count)).toBe(2);
    });

    it('has the required unique and expiry lookup indexes in MySQL', async () => {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'orders'
               AND INDEX_NAME IN ('uq_orders_lookup_token_hash', 'uq_orders_idempotency_key', 'idx_orders_expiration')
             ORDER BY INDEX_NAME, SEQ_IN_INDEX`
        );
        const shape = rows.map((row) => ({
            index: row.INDEX_NAME,
            column: row.COLUMN_NAME,
            order: Number(row.SEQ_IN_INDEX),
            nonUnique: Number(row.NON_UNIQUE),
        }));
        expect(shape).toEqual(expect.arrayContaining([
            { index: 'idx_orders_expiration', column: 'status', order: 1, nonUnique: 1 },
            { index: 'idx_orders_expiration', column: 'expires_at', order: 2, nonUnique: 1 },
            { index: 'uq_orders_idempotency_key', column: 'idempotency_key', order: 1, nonUnique: 0 },
            { index: 'uq_orders_lookup_token_hash', column: 'lookup_token_hash', order: 1, nonUnique: 0 },
        ]));
    });
});


