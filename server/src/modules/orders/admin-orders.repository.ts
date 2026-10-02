import { pool } from '../../database/pool.js';
import type { RowDataPacket, PoolConnection, ResultSetHeader } from 'mysql2/promise';

export interface AdminOrderListRow extends RowDataPacket {
    id: number;
    order_code: string;
    event_id: number;
    event_name: string;
    event_status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
    event_visibility: 'visible' | 'hidden';
    event_end_time: Date;
    ticket_type_names: string;
    buyer_name: string;
    buyer_email: string;
    total_quantity: number;
    total_amount: string;
    status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled';
    created_at: Date;
    expires_at: Date | null;
    confirmed_at: Date | null;
    refund_status: RefundStatus | null;
}

export interface AdminOrderDetailRow extends RowDataPacket {
    id: number;
    order_code: string;
    event_id: number;
    event_name: string;
    event_status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
    event_visibility: 'visible' | 'hidden';
    event_end_time: Date;
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
    attempt_count: number; next_attempt_at: Date | null;
    id: number;
    recipient: string;
    email_type: 'ticket_issued' | 'ticket_resent' | 'order_cancelled';
    status: 'pending' | 'processing' | 'sent' | 'failed';
    error_message: string | null;
    sent_at: Date | null;
    created_at: Date;
}

export type RefundStatus = 'not_required' | 'pending' | 'processing' | 'completed' | 'failed';
export interface AdminRefundRow extends RowDataPacket {
    id: number;
    order_id: number;
    amount: string;
    status: RefundStatus;
    reason: string;
    requested_at: Date;
    completed_at: Date | null;
    failure_reason: string | null;
    updated_at: Date;
}

export interface AdminOrderEventOptionRow extends RowDataPacket {
    id: number;
    name: string;
    status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
    refund_total: number;
    refund_not_required: number;
    refund_pending: number;
    refund_processing: number;
    refund_completed: number;
    refund_failed: number;
    refund_ticket_quantity: number;
    refund_amount: string;
    refund_pending_ticket_quantity: number;
    refund_pending_amount: string;
    refund_processing_ticket_quantity: number;
    refund_processing_amount: string;
    refund_failed_ticket_quantity: number;
    refund_failed_amount: string;
}

export interface EventRefundSummaryRow extends RowDataPacket {
    event_id: number;
    event_name: string;
    event_status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
    total: number;
    not_required: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    ticket_quantity: number;
    amount: string;
    pending_ticket_quantity: number;
    pending_amount: string;
    processing_ticket_quantity: number;
    processing_amount: string;
    failed_ticket_quantity: number;
    failed_amount: string;
}

export interface ResendTicketRow extends RowDataPacket {
    qr_token_hash: string; qr_token_encrypted: string | null;
    event_name: string; event_status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled'; event_visibility: 'visible' | 'hidden'; start_time: Date; end_time: Date; venue: string;
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
        `SELECT o.id, o.order_code, o.event_id, e.name AS event_name, e.status AS event_status,
                e.visibility AS event_visibility, e.end_time AS event_end_time,
                COALESCE((SELECT GROUP_CONCAT(oi.ticket_type_name ORDER BY oi.id SEPARATOR ', ')
                          FROM order_items oi WHERE oi.order_id = o.id), '—') AS ticket_type_names,
                o.buyer_name, o.buyer_email, o.total_quantity, o.total_amount,
                o.status, o.created_at, o.expires_at, o.confirmed_at, r.status AS refund_status
         FROM orders o
         JOIN events e ON e.id = o.event_id
         LEFT JOIN refunds r ON r.order_id = o.id
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
        `SELECT o.id, o.order_code, o.event_id, e.name AS event_name, e.status AS event_status,
                e.visibility AS event_visibility, e.end_time AS event_end_time,
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
        `SELECT id, recipient, email_type, status, error_message, attempt_count, next_attempt_at, sent_at, created_at
         FROM email_logs WHERE order_id = ? ORDER BY id DESC`,
        [orderId]
    );
    return rows;
}

export async function findOrderRefund(orderId: number) {
    const [rows] = await pool.query<AdminRefundRow[]>(
        `SELECT id, order_id, amount, status, reason, requested_at, completed_at, failure_reason, updated_at
         FROM refunds WHERE order_id = ? LIMIT 1`,
        [orderId]
    );
    return rows[0] ?? null;
}

export async function findAdminOrderEventOptions() {
    const [rows] = await pool.query<AdminOrderEventOptionRow[]>(
        `SELECT e.id, e.name, e.status,
                COUNT(r.id) AS refund_total,
                COALESCE(SUM(r.status = 'not_required'), 0) AS refund_not_required,
                COALESCE(SUM(r.status = 'pending'), 0) AS refund_pending,
                COALESCE(SUM(r.status = 'processing'), 0) AS refund_processing,
                COALESCE(SUM(r.status = 'completed'), 0) AS refund_completed,
                COALESCE(SUM(r.status = 'failed'), 0) AS refund_failed,
                COALESCE(SUM(CASE WHEN r.status <> 'not_required' THEN o.total_quantity ELSE 0 END), 0) AS refund_ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status <> 'not_required' THEN r.amount ELSE 0 END), 0) AS refund_amount,
                COALESCE(SUM(CASE WHEN r.status = 'pending' THEN o.total_quantity ELSE 0 END), 0) AS refund_pending_ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END), 0) AS refund_pending_amount,
                COALESCE(SUM(CASE WHEN r.status = 'processing' THEN o.total_quantity ELSE 0 END), 0) AS refund_processing_ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status = 'processing' THEN r.amount ELSE 0 END), 0) AS refund_processing_amount,
                COALESCE(SUM(CASE WHEN r.status = 'failed' THEN o.total_quantity ELSE 0 END), 0) AS refund_failed_ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END), 0) AS refund_failed_amount
         FROM events e
         JOIN orders o ON o.event_id = e.id
         LEFT JOIN refunds r ON r.order_id = o.id
         GROUP BY e.id, e.name, e.status
         ORDER BY e.name ASC, e.id ASC`
    );
    return rows;
}

export async function findRefundForUpdate(conn: PoolConnection, orderId: number) {
    const [rows] = await conn.query<AdminRefundRow[]>(
        `SELECT id, order_id, amount, status, reason, requested_at, completed_at, failure_reason, updated_at
         FROM refunds WHERE order_id = ? LIMIT 1 FOR UPDATE`,
        [orderId]
    );
    return rows[0] ?? null;
}

export async function transitionRefund(
    conn: PoolConnection,
    refundId: number,
    currentStatus: RefundStatus,
    nextStatus: 'processing' | 'completed' | 'failed',
    failureReason: string | null,
) {
    const [result] = await conn.query<ResultSetHeader>(
        `UPDATE refunds
         SET status = ?,
             completed_at = CASE WHEN ? = 'completed' THEN NOW(3) ELSE NULL END,
             failure_reason = CASE WHEN ? = 'failed' THEN ? ELSE NULL END
         WHERE id = ? AND status = ?`,
        [nextStatus, nextStatus, nextStatus, failureReason, refundId, currentStatus]
    );
    return result.affectedRows === 1;
}

export async function lockConfirmedOrdersForEvent(conn: PoolConnection, eventId: number) {
    const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM orders
         WHERE event_id = ? AND status = 'confirmed'
         ORDER BY id ASC FOR UPDATE`,
        [eventId]
    );
    return rows.map((row) => Number(row.id));
}

export async function transitionEventRefunds(
    conn: PoolConnection,
    eventId: number,
    nextStatus: 'processing' | 'completed',
) {
    const eligibleStatuses = nextStatus === 'processing' ? ['pending', 'failed'] : ['processing'];
    const [result] = await conn.query<ResultSetHeader>(
        `UPDATE refunds r
         JOIN orders o ON o.id = r.order_id
         SET r.status = ?,
             r.completed_at = CASE WHEN ? = 'completed' THEN NOW(3) ELSE NULL END,
             r.failure_reason = NULL
         WHERE o.event_id = ?
           AND o.status = 'confirmed'
           AND r.status IN (?)`,
        [nextStatus, nextStatus, eventId, eligibleStatuses]
    );
    return result.affectedRows;
}

export async function findEventRefundSummary(eventId: number) {
    const [rows] = await pool.query<EventRefundSummaryRow[]>(
        `SELECT e.id AS event_id, e.name AS event_name, e.status AS event_status,
                COUNT(r.id) AS total,
                COALESCE(SUM(r.status = 'not_required'), 0) AS not_required,
                COALESCE(SUM(r.status = 'pending'), 0) AS pending,
                COALESCE(SUM(r.status = 'processing'), 0) AS processing,
                COALESCE(SUM(r.status = 'completed'), 0) AS completed,
                COALESCE(SUM(r.status = 'failed'), 0) AS failed,
                COALESCE(SUM(CASE WHEN r.status <> 'not_required' THEN o.total_quantity ELSE 0 END), 0) AS ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status <> 'not_required' THEN r.amount ELSE 0 END), 0) AS amount,
                COALESCE(SUM(CASE WHEN r.status = 'pending' THEN o.total_quantity ELSE 0 END), 0) AS pending_ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status = 'pending' THEN r.amount ELSE 0 END), 0) AS pending_amount,
                COALESCE(SUM(CASE WHEN r.status = 'processing' THEN o.total_quantity ELSE 0 END), 0) AS processing_ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status = 'processing' THEN r.amount ELSE 0 END), 0) AS processing_amount,
                COALESCE(SUM(CASE WHEN r.status = 'failed' THEN o.total_quantity ELSE 0 END), 0) AS failed_ticket_quantity,
                COALESCE(SUM(CASE WHEN r.status = 'failed' THEN r.amount ELSE 0 END), 0) AS failed_amount
         FROM events e
         LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'confirmed'
         LEFT JOIN refunds r ON r.order_id = o.id
         WHERE e.id = ?
         GROUP BY e.id, e.name, e.status
         LIMIT 1`,
        [eventId]
    );
    return rows[0] ?? null;
}

export async function findTicketsForResend(orderId: number, conn?: PoolConnection, includeCancelled = false) {
    const [rows] = await (conn ?? pool).query<ResendTicketRow[]>(
        `SELECT t.id, t.order_item_id, t.ticket_code, t.qr_token_hash, t.qr_token_encrypted, tt.name AS ticket_type_name, t.holder_name, t.holder_email, e.name AS event_name, e.status AS event_status, e.visibility AS event_visibility, e.start_time, e.end_time, e.venue
         FROM tickets t
         JOIN order_items oi ON oi.id = t.order_item_id
         JOIN ticket_types tt ON tt.id = oi.ticket_type_id
         JOIN events e ON e.id = tt.event_id
         WHERE oi.order_id = ? ${includeCancelled ? '' : "AND t.status = 'issued'"}
         ORDER BY t.id ASC`,
        [orderId]
    );
    return rows;
}

/** Hủy order đang pending_payment: trả reserved_quantity, chuyển sang cancelled. */
export async function cancelPendingOrder(conn: PoolConnection, orderId: number) {
    const [items] = await conn.query<AdminOrderItemRow[]>(
        `SELECT ticket_type_id, quantity FROM order_items WHERE order_id = ? ORDER BY ticket_type_id ASC`,
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

export async function findOrderStats(eventId?: number) {
    const where = eventId ? 'WHERE event_id = ?' : '';
    const [rows] = await pool.query<RowDataPacket[]>(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(status = 'pending_payment'), 0) AS pendingPayment,
               COALESCE(SUM(status = 'confirmed'), 0) AS confirmed,
               COALESCE(SUM(status = 'expired'), 0) AS expired,
               COALESCE(SUM(status = 'cancelled'), 0) AS cancelled
        FROM orders ${where}`, eventId ? [eventId] : []);
    return {
        total: Number(rows[0]?.total ?? 0),
        pendingPayment: Number(rows[0]?.pendingPayment ?? 0),
        confirmed: Number(rows[0]?.confirmed ?? 0),
        expired: Number(rows[0]?.expired ?? 0),
        cancelled: Number(rows[0]?.cancelled ?? 0),
    };
}
