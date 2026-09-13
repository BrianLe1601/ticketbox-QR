import crypto from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import { withTransaction, findOrderByIdForUpdate, finishEmailLog } from '../checkout/checkout.repository.js';
import {
    findOrdersList, findOrderDetail, findOrderItems, findOrderTickets,
    findOrderPayments, findOrderEmailLogs, findTicketsForResend,
    insertResendEmailLog, rotateTicketQrToken, cancelPendingOrder, cancelConfirmedOrder,
} from './admin-orders.repository.js';
import type { ListOrdersQuery, CancelOrderBody } from './admin-orders.schema.js';
import { createTicketQrDataUrl } from '../../services/qr.service.js';
import { sendTicketEmail } from '../../services/mail.service.js';

export async function listOrders(query: ListOrdersQuery) {
    const { rows, total } = await findOrdersList(query);
    return {
        items: rows.map((o) => ({
            id: o.id,
            orderCode: o.order_code,
            eventId: o.event_id,
            eventName: o.event_name,
            buyerName: o.buyer_name,
            buyerEmail: o.buyer_email,
            totalQuantity: o.total_quantity,
            totalAmount: Number(o.total_amount),
            status: o.status,
            createdAt: o.created_at,
            expiresAt: o.expires_at,
            confirmedAt: o.confirmed_at,
        })),
        meta: { total, page: query.page, limit: query.limit },
    };
}

export async function getOrderDetail(orderId: number) {
    const order = await findOrderDetail(orderId);
    if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

    const [items, tickets, payments, emailLogs] = await Promise.all([
        findOrderItems(orderId),
        findOrderTickets(orderId),
        findOrderPayments(orderId),
        findOrderEmailLogs(orderId),
    ]);

    return {
        id: order.id,
        orderCode: order.order_code,
        eventId: order.event_id,
        eventName: order.event_name,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        buyerPhone: order.buyer_phone,
        totalQuantity: order.total_quantity,
        subtotalAmount: Number(order.subtotal_amount),
        discountAmount: Number(order.discount_amount),
        totalAmount: Number(order.total_amount),
        status: order.status,
        expiresAt: order.expires_at,
        confirmedAt: order.confirmed_at,
        expiredAt: order.expired_at,
        cancelledAt: order.cancelled_at,
        createdAt: order.created_at,
        items: items.map((it) => ({
            id: it.id,
            ticketTypeId: it.ticket_type_id,
            ticketTypeName: it.ticket_type_name,
            unitPrice: Number(it.unit_price),
            quantity: it.quantity,
            lineTotal: Number(it.line_total),
        })),
        tickets: tickets.map((t) => ({
            id: t.id,
            orderItemId: t.order_item_id,
            ticketCode: t.ticket_code,
            holderName: t.holder_name,
            holderEmail: t.holder_email,
            status: t.status,
            issuedAt: t.issued_at,
            checkedInAt: t.checked_in_at,
            cancelledAt: t.cancelled_at,
        })),
        payments: payments.map((p) => ({
            id: p.id,
            paymentCode: p.payment_code,
            method: p.method,
            amount: Number(p.amount),
            status: p.status,
            failureReason: p.failure_reason,
            paidAt: p.paid_at,
            createdAt: p.created_at,
        })),
        emailLogs: emailLogs.map((e) => ({
            id: e.id,
            recipient: e.recipient,
            emailType: e.email_type,
            status: e.status,
            errorMessage: e.error_message,
            sentAt: e.sent_at,
            createdAt: e.created_at,
        })),
    };
}

export async function cancelOrder(orderId: number, adminUserId: number, body: CancelOrderBody) {
    await withTransaction(async (conn) => {
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

        if (order.status === 'pending_payment') {
            await cancelPendingOrder(conn, orderId);
        } else if (order.status === 'confirmed') {
            await cancelConfirmedOrder(conn, orderId, adminUserId, body.reason ?? null);
        } else {
            throw AppError.badRequest(
                order.status === 'cancelled' ? 'Đơn hàng đã bị hủy trước đó' : 'Đơn hàng đã hết hạn, không thể hủy',
                'ORDER_NOT_CANCELLABLE'
            );
        }
    });

    return getOrderDetail(orderId);
}

/** Xoay vòng QR token của các vé chưa hủy rồi gửi lại email — QR trong email cũ sẽ mất hiệu lực. */
export async function resendTicketEmail(orderId: number) {
    const order = await findOrderDetail(orderId);
    if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');
    if (order.status !== 'confirmed') {
        throw AppError.badRequest('Chỉ gửi lại vé cho đơn hàng đã thanh toán', 'ORDER_NOT_CONFIRMED');
    }

    const ticketRows = await findTicketsForResend(orderId);
    if (ticketRows.length === 0) {
        throw AppError.badRequest('Đơn hàng không còn vé hợp lệ để gửi lại', 'NO_ACTIVE_TICKETS');
    }

    const tickets = await withTransaction(async (conn) => {
        const result: { ticketCode: string; ticketTypeName: string; qrDataUrl: string }[] = [];
        for (const row of ticketRows) {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
            await rotateTicketQrToken(conn, row.id, hash);
            result.push({
                ticketCode: row.ticket_code,
                ticketTypeName: row.ticket_type_name,
                qrDataUrl: await createTicketQrDataUrl(rawToken),
            });
        }
        return result;
    });

    const emailLogId = await insertResendEmailLog(orderId, order.buyer_email);
    try {
        const info = await sendTicketEmail({
            recipient: order.buyer_email,
            buyerName: order.buyer_name,
            orderCode: order.order_code,
            tickets,
        });
        await finishEmailLog(emailLogId, true, info.messageId);
        return {
            orderId, orderCode: order.order_code, buyerEmail: order.buyer_email,
            ticketCount: tickets.length, emailSent: true,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Gmail từ chối nhận thư';
        await finishEmailLog(emailLogId, false, undefined, message);
        throw AppError.badRequest(`Không gửi được email: ${message}`, 'EMAIL_SEND_FAILED');
    }
}