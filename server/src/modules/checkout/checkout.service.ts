import crypto from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import {
    withTransaction, findEventForOrder, lockTicketTypes, incrementReserved,
    insertOrder, insertOrderItem, findOrderByIdForUpdate, findOrderByIdReadOnly,
    findOrderItemsByOrderId, expireOrder, findExpiredPendingOrderIds, insertSuccessfulPayment,
    issueTicket, confirmOrderAndInventory, insertEmailLog,
    findOrderEventId, lockEventRow, findOrderByIdempotencyKeyForUpdate,
    findOrderItemsByOrderIdForUpdate, findOrderByIdempotencyKeyReadOnly,
} from './checkout.repository.js';
import type { CreateOrderBody } from './checkout.schema.js';
import { createTicketQrDataUrl } from '../../services/qr.service.js';
import { encryptQrToken } from '../../services/qr-encryption.service.js';
import { assertEmailVerified, consumeEmailVerification } from '../../services/email-verification.service.js';
import { env } from '../../config/env.js';

import { findTicketsForResend } from '../orders/admin-orders.repository.js';

const HOLD_MINUTES = 10;

function generateOrderCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `TBQ-${y}${m}${d}-${suffix}`;
}

function generateLookupToken(idempotencyKey: string): { raw: string; hash: string } {
    // Sinh token quyết định từ khóa retry để response bị thất lạc vẫn có thể
    // trả lại đúng lookup token, nhưng client không thể tự suy ra nếu thiếu secret.
    const raw = crypto.createHmac('sha256', env.JWT_SECRET)
        .update(`order-lookup:${idempotencyKey}`)
        .digest('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
}

function requestMatchesExistingOrder(
    order: NonNullable<Awaited<ReturnType<typeof findOrderByIdempotencyKeyForUpdate>>>,
    storedItems: Awaited<ReturnType<typeof findOrderItemsByOrderIdForUpdate>>,
    body: CreateOrderBody,
): boolean {
    const requestedItems = [...body.items].sort((a, b) => a.ticketTypeId - b.ticketTypeId);
    const normalizedPhone = body.buyer.phone?.trim() || null;
    return order.event_id === body.eventId
        && order.buyer_name === body.buyer.name
        && order.buyer_email === body.buyer.email
        && order.buyer_phone === normalizedPhone
        && storedItems.length === requestedItems.length
        && storedItems.every((item, index) => (
            item.ticket_type_id === requestedItems[index]?.ticketTypeId
            && item.quantity === requestedItems[index]?.quantity
        ));
}

function mapOrderResponse(
    order: NonNullable<Awaited<ReturnType<typeof findOrderByIdReadOnly>>>,
    items: Awaited<ReturnType<typeof findOrderItemsByOrderId>>,
    lookupToken?: string
) {
    return {
        id: order.id,
        orderCode: order.order_code,
        eventId: order.event_id,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        buyerPhone: order.buyer_phone,
        status: order.status,
        totalQuantity: order.total_quantity,
        subtotalAmount: Number(order.subtotal_amount),
        discountAmount: Number(order.discount_amount),
        totalAmount: Number(order.total_amount),
        expiresAt: order.expires_at,
        confirmedAt: order.confirmed_at,
        expiredAt: order.expired_at,
        cancelledAt: order.cancelled_at,
        createdAt: order.created_at,
        lookupToken, // chỉ có ngay sau khi tạo order, GET sau đó không trả lại
        items: items.map((it) => ({
            ticketTypeId: it.ticket_type_id,
            ticketTypeName: it.ticket_type_name,
            unitPrice: Number(it.unit_price),
            quantity: it.quantity,
            lineTotal: Number(it.line_total),
        })),
    };
}

export async function createOrder(body: CreateOrderBody, idempotencyKey: string, checkoutSession = '') {
    const { raw: lookupTokenRaw, hash: lookupTokenHash } = generateLookupToken(idempotencyKey);
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
    // Tránh khóa Event của request rồi mới khóa một Order thuộc Event khác.
    // event_id của Order là immutable nên preflight read này đủ để từ chối
    // trường hợp tái sử dụng key xuyên Event mà vẫn giữ global lock order.
    const existingSnapshot = await findOrderByIdempotencyKeyReadOnly(idempotencyKey);
    if (existingSnapshot && existingSnapshot.event_id !== body.eventId) {
        throw new AppError(409, 'Idempotency-Key đã được dùng cho một yêu cầu khác', 'IDEMPOTENCY_CONFLICT');
    }

    const transactionResult = await withTransaction(async (conn) => {
        const event = await findEventForOrder(conn, body.eventId);
        const existingOrder = await findOrderByIdempotencyKeyForUpdate(conn, idempotencyKey);
        if (existingOrder) {
            const existingItems = await findOrderItemsByOrderIdForUpdate(conn, existingOrder.id);
            if (!requestMatchesExistingOrder(existingOrder, existingItems, body)) {
                throw new AppError(409, 'Idempotency-Key đã được dùng cho một yêu cầu khác', 'IDEMPOTENCY_CONFLICT');
            }
            return { orderId: existingOrder.id, created: false };
        }

        assertEmailVerified(body.buyer.email, body.emailVerificationToken, checkoutSession);
        if (!event || !['published','ongoing'].includes(event.status) || event.visibility !== 'visible') {
            throw AppError.badRequest('Sự kiện không tồn tại hoặc chưa mở bán', 'EVENT_NOT_AVAILABLE');
        }
        const eventNow=Date.now();
        if(event.end_time.getTime()<=eventNow)throw AppError.badRequest('Event ticket sales are closed','EVENT_SALES_CLOSED');
        if(event.sales_start_at&&eventNow<event.sales_start_at.getTime())throw AppError.badRequest('Event ticket sales have not started','EVENT_SALES_NOT_STARTED');
        if(event.sales_end_at&&eventNow>event.sales_end_at.getTime())throw AppError.badRequest('Event ticket sales are closed','EVENT_SALES_CLOSED');

        const ticketTypeIds = body.items.map((i) => i.ticketTypeId);
        const lockedRows = await lockTicketTypes(conn, ticketTypeIds);
        const rowById = new Map(lockedRows.map((r) => [r.id, r]));

        let subtotal = 0;
        let totalQuantity = 0;
        const now = Date.now();
        const preparedItems: { ticketTypeId: number; name: string; unitPrice: number; quantity: number; lineTotal: number }[] = [];

        for (const item of body.items) {
            const row = rowById.get(item.ticketTypeId);
            if (!row || row.event_id !== body.eventId || !row.is_active) {
                throw AppError.badRequest(`Loại vé không hợp lệ (id ${item.ticketTypeId})`, 'INVALID_TICKET_TYPE');
            }

            const salesStart = row.sales_start_at ? new Date(row.sales_start_at).getTime() : null;
            const salesEnd = row.sales_end_at ? new Date(row.sales_end_at).getTime() : null;
            if (salesStart && now < salesStart) {
                throw AppError.badRequest(`${row.name} chưa mở bán`, 'TICKET_NOT_ON_SALE');
            }
            if (salesEnd && now > salesEnd) {
                throw AppError.badRequest(`${row.name} đã đóng bán`, 'TICKET_SALES_CLOSED');
            }
            if (item.quantity > row.max_per_order) {
                throw AppError.badRequest(`${row.name} tối đa ${row.max_per_order} vé/đơn`, 'MAX_PER_ORDER_EXCEEDED');
            }

            // Đọc trên row đã bị FOR UPDATE khóa -> con số này chắc chắn mới nhất
            // tại thời điểm này, không bị request song song nào ghi đè giữa chừng.
            const available = row.capacity - row.reserved_quantity - row.sold_quantity;
            if (item.quantity > available) {
                throw AppError.badRequest(
                    available > 0 ? `${row.name} chỉ còn ${available} vé` : `${row.name} đã hết vé`,
                    'SOLD_OUT'
                );
            }

            const unitPrice = Number(row.price);
            const lineTotal = unitPrice * item.quantity;
            subtotal += lineTotal;
            totalQuantity += item.quantity;
            preparedItems.push({ ticketTypeId: row.id, name: row.name, unitPrice, quantity: item.quantity, lineTotal });
        }

        // order_code có phần suffix ngẫu nhiên, xác suất trùng cực thấp nhưng vẫn
        // retry vài lần nếu đụng UNIQUE constraint thay vì để lỗi 500 hiếm gặp lọt ra.
        let newOrderId: number | null = null;
        let lastError: unknown;
        for (let attempt = 0; attempt < 3 && newOrderId === null; attempt++) {
            try {
                newOrderId = await insertOrder(conn, {
                    orderCode: generateOrderCode(),
                    eventId: body.eventId,
                    buyerName: body.buyer.name,
                    buyerEmail: body.buyer.email,
                    buyerPhone: body.buyer.phone?.trim() ? body.buyer.phone.trim() : null,
                    totalQuantity,
                    subtotalAmount: subtotal,
                    lookupTokenHash,
                    idempotencyKey,
                    expiresAt,
                });
            } catch (err) {
                lastError = err;
                const isDupOrderCode = (err as { code?: string; sqlMessage?: string })?.code === 'ER_DUP_ENTRY'
                    && (err as { sqlMessage?: string }).sqlMessage?.includes('order_code');
                const isDupIdempotencyKey = (err as { code?: string; sqlMessage?: string })?.code === 'ER_DUP_ENTRY'
                    && (err as { sqlMessage?: string }).sqlMessage?.includes('idempotency_key');
                if (isDupIdempotencyKey) {
                    throw new AppError(409, 'Idempotency-Key đã được dùng cho một yêu cầu khác', 'IDEMPOTENCY_CONFLICT');
                }
                if (!isDupOrderCode) throw err;
            }
        }
        if (newOrderId === null) throw lastError;

        for (const item of preparedItems) {
            await insertOrderItem(conn, {
                orderId: newOrderId,
                ticketTypeId: item.ticketTypeId,
                ticketTypeName: item.name,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
            });
            await incrementReserved(conn, item.ticketTypeId, item.quantity);
        }

        return { orderId: newOrderId, created: true };
    });

    const order = await findOrderByIdReadOnly(transactionResult.orderId);
    const items = await findOrderItemsByOrderId(transactionResult.orderId);
    if (!order) throw AppError.notFound('Không tìm thấy đơn hàng vừa tạo');
    if (transactionResult.created) consumeEmailVerification(body.emailVerificationToken);
    return mapOrderResponse(order, items, lookupTokenRaw);
}

/** Nếu order đang pending mà đã quá expires_at thì chuyển sang expired ngay lúc đọc,
 *  không cần đợi job nền -> người dùng luôn thấy trạng thái đúng khi F5/gọi lại API. */
export async function expireOrderIfNeeded(orderId: number) {
    await withTransaction(async (conn) => {
        const eventId = await findOrderEventId(conn, orderId);
        if (eventId === null) return;
        await lockEventRow(conn, eventId);
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order) return;
        if (order.status === 'pending_payment' && order.expires_at && order.expires_at.getTime() <= Date.now()) {
            await expireOrder(conn, order.id);
        }
    });
}

export async function getOrderByLookupToken(orderId: number, token: string) {
    await expireOrderIfNeeded(orderId);

    const order = await findOrderByIdReadOnly(orderId);
    if (!order) {
        throw AppError.notFound('Không tìm thấy đơn hàng');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (tokenHash !== order.lookup_token_hash) {
        throw AppError.notFound('Không tìm thấy đơn hàng');
    }

    const items = await findOrderItemsByOrderId(orderId);
    return mapOrderResponse(order, items);
}

/** Dùng cho job nền: dọn hàng loạt order pending đã quá giờ giữ vé. */
export async function expireStaleOrders(): Promise<number> {
    const ids = await findExpiredPendingOrderIds();
    for (const id of ids) {
        await expireOrderIfNeeded(id);
    }
    return ids.length;
}

export async function payOrder(orderId: number, token: string) {
    // Kiểm tra hạn và thanh toán trong cùng một transaction. Như vậy không có
    // khe thời gian nơi đồng hồ vừa hết hạn nhưng release lại bị rollback hoặc
    // payment vẫn tiếp tục.
    const paymentOutcome = await withTransaction(async (conn) => {
        const eventId = await findOrderEventId(conn, orderId);
        if (eventId === null) throw AppError.notFound('Không tìm thấy đơn hàng');
        await lockEventRow(conn, eventId);
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        if (tokenHash !== order.lookup_token_hash) throw AppError.notFound('Không tìm thấy đơn hàng');
        if (order.status !== 'pending_payment') {
            throw AppError.badRequest(order.status === 'confirmed' ? 'Đơn hàng đã được thanh toán' : 'Đơn hàng không còn hiệu lực', 'ORDER_NOT_PAYABLE');
        }
        if (!order.expires_at || order.expires_at.getTime() <= Date.now()) {
            await expireOrder(conn, order.id);
            // Không throw trong transaction: phải commit việc nhả reserved trước,
            // rồi mới trả lỗi cho client ở bên ngoài transaction.
            return { kind: 'expired' as const };
        }

        const items = await confirmOrderAndInventory(conn, order.id);
        await insertSuccessfulPayment(conn, order.id, Number(order.total_amount), `PAY-${crypto.randomBytes(8).toString('hex').toUpperCase()}`);

        const tickets: { ticketCode: string; ticketTypeName: string; rawToken: string }[] = [];
        for (const item of items) {
            for (let index = 0; index < item.quantity; index++) {
                const rawToken = crypto.randomBytes(32).toString('hex');
                const ticketCode = `TKT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
                await issueTicket(conn, {
                    orderItemId: item.id,
                    ticketCode,
                    qrTokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
                    qrTokenEncrypted: encryptQrToken(rawToken, ticketCode),
                    holderName: order.buyer_name,
                    holderEmail: order.buyer_email,
                });
                tickets.push({ ticketCode, ticketTypeName: item.ticket_type_name, rawToken });
            }
        }
        const emailLogId = await insertEmailLog(order.id, order.buyer_email, conn);
        return { kind: 'issued' as const, order, tickets, emailLogId };
    });

    if (paymentOutcome.kind === 'expired') {
        throw AppError.badRequest('Đơn hàng đã hết 10 phút giữ vé', 'ORDER_EXPIRED');
    }
    const issued = paymentOutcome;

    const mailRows = await findTicketsForResend(issued.order.id, undefined, true);
    const tickets = await Promise.all(issued.tickets.map(async (ticket) => ({
        eventName: mailRows.find(row => row.ticket_code === ticket.ticketCode)!.event_name,
        startTime: mailRows.find(row => row.ticket_code === ticket.ticketCode)!.start_time,
        endTime: mailRows.find(row => row.ticket_code === ticket.ticketCode)!.end_time,
        venue: mailRows.find(row => row.ticket_code === ticket.ticketCode)!.venue,
        ticketCode: ticket.ticketCode,
        ticketTypeName: ticket.ticketTypeName,
        qrDataUrl: await createTicketQrDataUrl(ticket.rawToken),
    })));


    return {
        orderId: issued.order.id,
        orderCode: issued.order.order_code,
        status: 'confirmed' as const,
        buyerEmail: issued.order.buyer_email,
        emailSent: false,
        emailMessage: 'Vé đã được tạo. Email đang được gửi đến địa chỉ của bạn.',
        tickets,
    };
}
