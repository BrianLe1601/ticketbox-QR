import { AppError } from '../../utils/app-error.js';
import { withTransaction, findOrderByIdForUpdate, findOrderEventId, lockEventRow } from '../checkout/checkout.repository.js';
import {
    findOrderStats, findOrdersList, findOrderDetail, findOrderItems, findOrderTickets,
    findOrderPayments, findOrderEmailLogs, findOrderRefund, findAdminOrderEventOptions,
    cancelPendingOrder, findRefundForUpdate, transitionRefund,
} from './admin-orders.repository.js';
import type { ListOrdersQuery, RefundTransitionBody } from './admin-orders.schema.js';
import { enqueueTicketEmail } from '../tickets/ticket-email.repository.js';

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

    const [items, tickets, payments, emailLogs, refund] = await Promise.all([
        findOrderItems(orderId),
        findOrderTickets(orderId),
        findOrderPayments(orderId),
        findOrderEmailLogs(orderId),
        findOrderRefund(orderId),
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
        refund: refund ? {
            id: refund.id,
            orderId: refund.order_id,
            amount: Number(refund.amount),
            status: refund.status,
            reason: refund.reason,
            requestedAt: refund.requested_at,
            completedAt: refund.completed_at,
            failureReason: refund.failure_reason,
            updatedAt: refund.updated_at,
        } : null,
        emailLogs: emailLogs.map((e) => ({
            id: e.id,
            recipient: e.recipient,
            emailType: e.email_type,
            status: e.status,
            errorMessage: e.error_message,
            attemptCount: e.attempt_count,
            nextAttemptAt: e.next_attempt_at,
            sentAt: e.sent_at,
            createdAt: e.created_at,
        })),
    };
}

export async function cancelOrder(orderId: number) {
    await withTransaction(async (conn) => {
        const eventId = await findOrderEventId(conn, orderId);
        if (eventId === null) throw AppError.notFound('Không tìm thấy đơn hàng');
        await lockEventRow(conn, eventId);
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

        if (order.status === 'pending_payment') {
            await cancelPendingOrder(conn, orderId);
        } else {
            const message = order.status === 'confirmed'
                ? 'Đơn đã xác nhận phải giữ nguyên lịch sử; chỉ xử lý hoàn tiền mô phỏng trong luồng hủy sự kiện'
                : order.status === 'cancelled' ? 'Đơn hàng đã bị hủy trước đó' : 'Đơn hàng đã hết hạn, không thể hủy';
            throw new AppError(409, message, 'ORDER_NOT_CANCELLABLE');
        }
    });

    return getOrderDetail(orderId);
}

export async function updateRefundStatus(orderId: number, input: RefundTransitionBody) {
    await withTransaction(async (conn) => {
        const eventId = await findOrderEventId(conn, orderId);
        if (eventId === null) throw AppError.notFound('Không tìm thấy đơn hàng');
        await lockEventRow(conn, eventId);
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');
        if (order.status !== 'confirmed') {
            throw new AppError(409, 'Chỉ đơn đã xác nhận mới có quy trình hoàn tiền mô phỏng', 'REFUND_ORDER_NOT_CONFIRMED');
        }
        const refund = await findRefundForUpdate(conn, orderId);
        if (!refund) throw AppError.notFound('Đơn hàng chưa có yêu cầu hoàn tiền mô phỏng', 'REFUND_NOT_FOUND');

        const allowed = refund.status === 'pending'
            ? input.status === 'processing'
            : refund.status === 'processing'
                ? ['completed', 'failed'].includes(input.status)
                : refund.status === 'failed' && input.status === 'processing';
        if (!allowed) {
            throw new AppError(409, `Không thể chuyển hoàn tiền mô phỏng từ ${refund.status} sang ${input.status}`, 'INVALID_REFUND_TRANSITION');
        }
        if (!await transitionRefund(conn, refund.id, refund.status, input.status, input.failureReason ?? null)) {
            throw new AppError(409, 'Trạng thái hoàn tiền mô phỏng vừa thay đổi; vui lòng tải lại', 'REFUND_CONFLICT');
        }
    });
    return getOrderDetail(orderId);
}

/** Queue delivery of the original QR; never rotate credentials. */
export async function resendTicketEmail(orderId: number) {
    const order = await findOrderDetail(orderId);
    if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');
    const queued = await enqueueTicketEmail(orderId, order.buyer_email, 'ticket_resent');
    return { orderId, ...queued, message: 'Đã xếp lịch gửi lại vé.' };
}

export async function retryOrderEmail(orderId: number, logId: number) {
    const order = await findOrderDetail(orderId);
    if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');
    const queued = await enqueueTicketEmail(orderId, order.buyer_email, 'ticket_resent', logId);
    return { orderId, ...queued, message: 'Đã xếp lịch thử gửi lại email.' };
}
export async function getOrderStats(eventId?: number) { return findOrderStats(eventId); }
export async function getOrderFilterOptions() {
    return { events: (await findAdminOrderEventOptions()).map((event) => ({ id: event.id, name: event.name })) };
}
