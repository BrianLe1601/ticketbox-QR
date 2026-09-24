import { pool } from '../../database/pool.js';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface LockedTicketTypeRow extends RowDataPacket {
    id: number;
    event_id: number;
    name: string;
    price: string;
    capacity: number;
    reserved_quantity: number;
    sold_quantity: number;
    max_per_order: number;
    sales_start_at: Date | null;
    sales_end_at: Date | null;
    is_active: number;
}

export interface EventForOrderRow extends RowDataPacket {
    id: number;
    status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
    visibility: 'visible' | 'hidden';
    start_time: Date;
    end_time: Date;
    sales_start_at: Date | null;
    sales_end_at: Date | null;
}

export interface OrderRow extends RowDataPacket {
    id: number;
    order_code: string;
    event_id: number;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string | null;
    total_quantity: number;
    subtotal_amount: string;
    discount_amount: string;
    total_amount: string;
    status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled';
    lookup_token_hash: string;
    idempotency_key: string;
    expires_at: Date | null;
    confirmed_at: Date | null;
    expired_at: Date | null;
    cancelled_at: Date | null;
    created_at: Date;
}

export interface OrderItemRow extends RowDataPacket {
    id: number;
    ticket_type_id: number;
    ticket_type_name: string;
    unit_price: string;
    quantity: number;
    line_total: string;
}

export interface IssuedTicketRow extends RowDataPacket {
    id: number;
    ticket_code: string;
    ticket_type_name: string;
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export async function findEventForOrder(conn: PoolConnection, eventId: number) {
    const [rows] = await conn.query<EventForOrderRow[]>(
        `SELECT id, status, visibility, start_time, end_time, sales_start_at, sales_end_at
         FROM events WHERE id = ? LIMIT 1 FOR UPDATE`,
        [eventId]
    );
    return rows[0] ?? null;
}

/**
 * Khóa các row ticket_types cần đặt, theo thứ tự id tăng dần để 2 order khác nhau
 * cùng đụng nhiều loại vé không bị deadlock lẫn nhau. Request nào lock trước sẽ
 * đọc/ghi reserved_quantity trước; request sau phải đợi commit/rollback xong mới
 * đọc được số liệu mới nhất -> không thể cả 2 cùng thấy "còn 1 vé" rồi cùng trừ.
 */
export async function lockTicketTypes(conn: PoolConnection, ticketTypeIds: number[]) {
    if (ticketTypeIds.length === 0) return [];
    const sorted = [...new Set(ticketTypeIds)].sort((a, b) => a - b);
    const placeholders = sorted.map(() => '?').join(', ');
    const [rows] = await conn.query<LockedTicketTypeRow[]>(
        `SELECT id, event_id, name, price, capacity, reserved_quantity, sold_quantity,
                max_per_order, sales_start_at, sales_end_at, is_active
         FROM ticket_types
         WHERE id IN (${placeholders})
         ORDER BY id ASC
         FOR UPDATE`,
        sorted
    );
    return rows;
}

export async function incrementReserved(conn: PoolConnection, ticketTypeId: number, quantity: number) {
    const [result] = await conn.query<ResultSetHeader>(
        `UPDATE ticket_types
         SET reserved_quantity = reserved_quantity + ?
         WHERE id = ? AND reserved_quantity + sold_quantity + ? <= capacity`,
        [quantity, ticketTypeId, quantity]
    );
    if (result.affectedRows !== 1) {
        throw new Error(`Không thể giữ ${quantity} vé cho ticket type ${ticketTypeId}: tồn kho đã thay đổi`);
    }
}

export async function insertOrder(conn: PoolConnection, data: {
    orderCode: string;
    eventId: number;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string | null;
    totalQuantity: number;
    subtotalAmount: number;
    lookupTokenHash: string;
    idempotencyKey: string;
    expiresAt: Date;
}) {
    const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO orders
            (order_code, event_id, buyer_name, buyer_email, buyer_phone,
             total_quantity, subtotal_amount, discount_amount, total_amount,
             status, lookup_token_hash, idempotency_key, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'pending_payment', ?, ?, ?)`,
        [
            data.orderCode, data.eventId, data.buyerName, data.buyerEmail, data.buyerPhone,
            data.totalQuantity, data.subtotalAmount, data.subtotalAmount,
            data.lookupTokenHash, data.idempotencyKey, data.expiresAt,
        ]
    );
    return result.insertId;
}

export async function insertOrderItem(conn: PoolConnection, data: {
    orderId: number;
    ticketTypeId: number;
    ticketTypeName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
}) {
    await conn.query(
        `INSERT INTO order_items
            (order_id, ticket_type_id, ticket_type_name, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.orderId, data.ticketTypeId, data.ticketTypeName, data.unitPrice, data.quantity, data.lineTotal]
    );
}

export async function findOrderByIdForUpdate(conn: PoolConnection, orderId: number) {
    const [rows] = await conn.query<OrderRow[]>(
        `SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE`,
        [orderId]
    );
    return rows[0] ?? null;
}

export async function findOrderByIdempotencyKeyForUpdate(conn: PoolConnection, idempotencyKey: string) {
    const [rows] = await conn.query<OrderRow[]>(
        `SELECT * FROM orders WHERE idempotency_key = ? LIMIT 1 FOR UPDATE`,
        [idempotencyKey]
    );
    return rows[0] ?? null;
}

export async function findOrderItemsByOrderIdForUpdate(conn: PoolConnection, orderId: number) {
    const [rows] = await conn.query<OrderItemRow[]>(
        `SELECT id, ticket_type_id, ticket_type_name, unit_price, quantity, line_total
         FROM order_items WHERE order_id = ? ORDER BY ticket_type_id ASC FOR UPDATE`,
        [orderId]
    );
    return rows;
}

/**
 * Settlement/expiry flows first resolve the immutable Event id, then lock the
 * Event before locking the Order. This keeps the global lock order identical
 * to checkout creation and Event cancellation: Event -> Order -> Ticket Type.
 */
export async function findOrderEventId(conn: PoolConnection, orderId: number) {
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT event_id FROM orders WHERE id = ? LIMIT 1`,
        [orderId]
    );
    return rows[0] ? Number(rows[0].event_id) : null;
}

export async function lockEventRow(conn: PoolConnection, eventId: number) {
    await conn.query(
        `SELECT id FROM events WHERE id = ? LIMIT 1 FOR UPDATE`,
        [eventId]
    );
}

export async function findOrderByIdReadOnly(orderId: number) {
    const [rows] = await pool.query<OrderRow[]>(
        `SELECT * FROM orders WHERE id = ? LIMIT 1`,
        [orderId]
    );
    return rows[0] ?? null;
}

export async function findOrderByIdempotencyKeyReadOnly(idempotencyKey: string) {
    const [rows] = await pool.query<OrderRow[]>(
        `SELECT * FROM orders WHERE idempotency_key = ? LIMIT 1`,
        [idempotencyKey]
    );
    return rows[0] ?? null;
}

export async function findOrderItemsByOrderId(orderId: number) {
    const [rows] = await pool.query<OrderItemRow[]>(
        `SELECT ticket_type_id, ticket_type_name, unit_price, quantity, line_total
         FROM order_items WHERE order_id = ? ORDER BY id ASC`,
        [orderId]
    );
    return rows;
}

export async function insertSuccessfulPayment(conn: PoolConnection, orderId: number, amount: number, paymentCode: string) {
    await conn.query(
        `INSERT INTO payments (order_id, payment_code, method, amount, status, paid_at)
         VALUES (?, ?, 'simulated', ?, 'success', NOW(3))`,
        [orderId, paymentCode, amount]
    );
}

export async function issueTicket(conn: PoolConnection, data: {
    orderItemId: number; ticketCode: string; qrTokenHash: string; qrTokenEncrypted: string; holderName: string; holderEmail: string;
}) {
    const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO tickets (order_item_id, ticket_code, qr_token_hash, qr_token_encrypted, holder_name, holder_email)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.orderItemId, data.ticketCode, data.qrTokenHash, data.qrTokenEncrypted, data.holderName, data.holderEmail]
    );
    return result.insertId;
}

export async function confirmOrderAndInventory(conn: PoolConnection, orderId: number) {
    const items = await findOrderItemsByOrderIdForUpdate(conn, orderId);
    for (const item of items) {
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE ticket_types
             SET reserved_quantity = reserved_quantity - ?, sold_quantity = sold_quantity + ?
             WHERE id = ? AND reserved_quantity >= ?`,
            [item.quantity, item.quantity, item.ticket_type_id, item.quantity]
        );
        if (result.affectedRows !== 1) {
            throw new Error(`Không thể chốt order ${orderId}: reserved_quantity không nhất quán`);
        }
    }
    await conn.query(`UPDATE orders SET status = 'confirmed', confirmed_at = NOW(3) WHERE id = ?`, [orderId]);
    return items;
}

export async function findIssuedTickets(orderId: number) {
    const [rows] = await pool.query<IssuedTicketRow[]>(
        `SELECT t.id, t.ticket_code, oi.ticket_type_name
         FROM tickets t JOIN order_items oi ON oi.id = t.order_item_id
         WHERE oi.order_id = ? ORDER BY t.id ASC`,
        [orderId]
    );
    return rows;
}

export async function insertEmailLog(orderId: number, recipient: string, conn?: PoolConnection) {
    const [result] = await (conn ?? pool).query<ResultSetHeader>(
        `INSERT INTO email_logs (order_id, recipient, email_type, status)
         VALUES (?, ?, 'ticket_issued', 'pending')`,
        [orderId, recipient]
    );
    return result.insertId;
}

export async function finishEmailLog(id: number, success: boolean, providerId?: string, errorMessage?: string) {
    if (success) {
        await pool.query(`UPDATE email_logs SET status = 'sent', provider_id = ?, sent_at = NOW(3) WHERE id = ?`, [providerId ?? null, id]);
    } else {
        await pool.query(`UPDATE email_logs SET status = 'failed', error_message = ? WHERE id = ?`, [(errorMessage ?? 'Không gửi được email').slice(0, 500), id]);
    }
}

/** Trả reserved_quantity đã giữ về ticket_types rồi chuyển order sang expired. */
export async function expireOrder(conn: PoolConnection, orderId: number) {
    const items = await findOrderItemsByOrderIdForUpdate(conn, orderId);
    for (const item of items) {
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE ticket_types
             SET reserved_quantity = reserved_quantity - ?
             WHERE id = ? AND reserved_quantity >= ?`,
            [item.quantity, item.ticket_type_id, item.quantity]
        );
        if (result.affectedRows !== 1) {
            throw new Error(`Không thể hết hạn order ${orderId}: reserved_quantity không nhất quán`);
        }
    }
    await conn.query(
        `UPDATE orders SET status = 'expired', expired_at = NOW(3) WHERE id = ?`,
        [orderId]
    );
}

/** Dùng cho job định kỳ quét order pending đã quá giờ giữ vé. */
export async function findExpiredPendingOrderIds(): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM orders
         WHERE status = 'pending_payment' AND expires_at IS NOT NULL AND expires_at < NOW(3)`
    );
    return rows.map((r) => r.id as number);
}
