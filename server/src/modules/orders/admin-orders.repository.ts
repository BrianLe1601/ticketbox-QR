import { pool } from '../../database/pool.js';
import type { RowDataPacket, PoolConnection, ResultSetHeader } from 'mysql2/promise';

export interface AdminOrderListRow extends RowDataPacket {
    id: number;
    order_code: string;
    event_id: number;
    event_name: string;
    buyer_name: string;
    buyer_email: string;
    total_quantity: number;
    total_amount: string;
    status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled';
    created_at: Date;
    expires_at: Date | null;
    confirmed_at: Date | null;
}

export interface AdminOrderDetailRow extends RowDataPacket {
    id: number;
    order_code: string;
    event_id: number;
    event_name: string;
    buyer_name: string;
    buyer_email: string;
    buyer_phone: string | null;
    total_quantity: number;
    subtotal_amount: string;
    discount_amount: string;
    total_amount: string;
    status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled';
    expires_at: Date | null;
    confirmed_at: Date | null;
    expired_at: Date | null;
    cancelled_at: Date | null;
    created_at: Date;
}

export interface AdminOrderItemRow extends RowDataPacket {
    id: number;
    ticket_type_id: number;
    ticket_type_name: string;
    unit_price: string;
    quantity: number;
    line_total: string;
}

export interface AdminTicketRow extends RowDataPacket {
    id: number;
    order_item_id: number;
    ticket_code: string;
    holder_name: string | null;
    holder_email: string | null;
    status: 'issued' | 'checked_in' | 'cancelled';
    issued_at: Date;
    checked_in_at: Date | null;
    cancelled_at: Date | null;
}

export interface AdminPaymentRow extends RowDataPacket {
    id: number;
    payment_code: string;
    method: 'free' | 'simulated';
    amount: string;
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    failure_reason: string | null;
    paid_at: Date | null;
    created_at: Date;
}

export interface AdminEmailLogRow extends RowDataPacket {
    id: number;
    recipient: string;
    email_type: 'ticket_issued' | 'ticket_resent' | 'order_cancelled';
    status: 'pending' | 'sent' | 'failed';
    error_message: string | null;
    sent_at: Date | null;
    created_at: Date;
}

export interface ResendTicketRow extends RowDataPacket {
    id: number;
    order_item_id: number;
    ticket_code: string;
    ticket_type_name: string;
    holder_name: string | null;
    holder_email: string | null;
}

export async function findOrdersList(filters: {
    status?: string | undefined;
    eventId?: number | undefined;
    buyerEmail?: string | undefined;
    page: number;
    limit: number;
}) {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filters.status) { where.push('o.status = ?'); params.push(filters.status); }
    if (filters.eventId) { where.push('o.event_id = ?'); params.push(filters.eventId); }
    if (filters.buyerEmail) { where.push('o.buyer_email LIKE ?'); params.push(`%${filters.buyerEmail}%`); }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.limit;

    const [rows] = await pool.query<AdminOrderListRow[]>(
        `SELECT o.id, o.order_code, o.event_id, e.name AS event_name,
                o.buyer_name, o.buyer_email, o.total_quantity, o.total_amount,
                o.status, o.created_at, o.expires_at, o.confirmed_at
         FROM orders o
         JOIN events e ON e.id = o.event_id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, filters.limit, offset]
    );

    const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM orders o ${whereClause}`,
        params
    );
    const total = Number(countRows[0]?.total ?? 0);

    return { rows, total };
}

export async function findOrderDetail(orderId: number) {
    const [rows] = await pool.query<AdminOrderDetailRow[]>(
        `SELECT o.id, o.order_code, o.event_id, e.name AS event_name,
                o.buyer_name, o.buyer_email, o.buyer_phone,
                o.total_quantity, o.subtotal_amount, o.discount_amount, o.total_amount,
                o.status, o.expires_at, o.confirmed_at, o.expired_at, o.cancelled_at, o.created_at
         FROM orders o
         JOIN events e ON e.id = o.event_id
         WHERE o.id = ? LIMIT 1`,
        [orderId]
    );
    return rows[0] ?? null;
}

export async function findOrderItems(orderId: number) {
    const [rows] = await pool.query<AdminOrderItemRow[]>(
        `SELECT id, ticket_type_id, ticket_type_name, unit_price, quantity, line_total
         FROM order_items WHERE order_id = ? ORDER BY id ASC`,
        [orderId]
    );
    return rows;
}

export async function findOrderTickets(orderId: number) {
    const [rows] = await pool.query<AdminTicketRow[]>(
        `SELECT t.id, t.order_item_id, t.ticket_code, t.holder_name, t.holder_email,
                t.status, t.issued_at, t.checked_in_at, t.cancelled_at
         FROM tickets t
         JOIN order_items oi ON oi.id = t.order_item_id
         WHERE oi.order_id = ? ORDER BY t.id ASC`,
        [orderId]
    );
    return rows;
}

export async function findOrderPayments(orderId: number) {
    const [rows] = await pool.query<AdminPaymentRow[]>(
        `SELECT id, payment_code, method, amount, status, failure_reason, paid_at, created_at
         FROM payments WHERE order_id = ? ORDER BY id ASC`,
        [orderId]
    );
    return rows;
}

export async function findOrderEmailLogs(orderId: number) {
    const [rows] = await pool.query<AdminEmailLogRow[]>(
        `SELECT id, recipient, email_type, status, error_message, sent_at, created_at
         FROM email_logs WHERE order_id = ? ORDER BY id DESC`,
        [orderId]
    );
    return rows;
}

export async function findTicketsForResend(orderId: number) {
    const [rows] = await pool.query<ResendTicketRow[]>(
        `SELECT t.id, t.order_item_id, t.ticket_code, oi.ticket_type_name, t.holder_name, t.holder_email
         FROM tickets t
         JOIN order_items oi ON oi.id = t.order_item_id
         WHERE oi.order_id = ? AND t.status != 'cancelled'
         ORDER BY t.id ASC`,
        [orderId]
    );
    return rows;
}

export async function insertResendEmailLog(orderId: number, recipient: string) {
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO email_logs (order_id, recipient, email_type, status)
         VALUES (?, ?, 'ticket_resent', 'pending')`,
        [orderId, recipient]
    );
    return result.insertId;
}

export async function rotateTicketQrToken(conn: PoolConnection, ticketId: number, newHash: string) {
    await conn.query(`UPDATE tickets SET qr_token_hash = ? WHERE id = ?`, [newHash, ticketId]);
}

/** Hủy order đang pending_payment: trả reserved_quantity, chuyển sang cancelled. */
export async function cancelPendingOrder(conn: PoolConnection, orderId: number) {
    const [items] = await conn.query<AdminOrderItemRow[]>(
        `SELECT ticket_type_id, quantity FROM order_items WHERE order_id = ?`,
        [orderId]
    );
    for (const item of items) {
        await conn.query(
            `UPDATE ticket_types SET reserved_quantity = GREATEST(0, reserved_quantity - ?) WHERE id = ?`,
            [item.quantity, item.ticket_type_id]
        );
    }
    await conn.query(`UPDATE orders SET status = 'cancelled', cancelled_at = NOW(3) WHERE id = ?`, [orderId]);
}

/**
 * Hủy order đã confirmed: chỉ hủy các vé còn ở trạng thái 'issued' (chưa check-in),
 * và chỉ trả sold_quantity đúng bằng số vé thực sự bị hủy — vé đã check-in giữ nguyên,
 * không hoàn lại tồn kho cho vé khách đã vào cửa.
 */
export async function cancelConfirmedOrder(
    conn: PoolConnection,
    orderId: number,
    adminUserId: number,
    reason: string | null
) {
    const [items] = await conn.query<AdminOrderItemRow[]>(
        `SELECT id, ticket_type_id FROM order_items WHERE order_id = ?`,
        [orderId]
    );
    for (const item of items) {
        const [result] = await conn.query<ResultSetHeader>(
            `UPDATE tickets
             SET status = 'cancelled', cancelled_at = NOW(3), cancelled_by = ?, cancel_reason = ?
             WHERE order_item_id = ? AND status = 'issued'`,
            [adminUserId, (reason ?? 'Hủy bởi quản trị viên').slice(0, 255), item.id]
        );
        if (result.affectedRows > 0) {
            await conn.query(
                `UPDATE ticket_types SET sold_quantity = GREATEST(0, sold_quantity - ?) WHERE id = ?`,
                [result.affectedRows, item.ticket_type_id]
            );
        }
    }
    await conn.query(`UPDATE orders SET status = 'cancelled', cancelled_at = NOW(3) WHERE id = ?`, [orderId]);
}