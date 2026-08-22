import crypto from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import {
    withTransaction, findEventForOrder, lockTicketTypes, incrementReserved,
    insertOrder, insertOrderItem, findOrderByIdForUpdate, findOrderByIdReadOnly,
    findOrderItemsByOrderId, expireOrder, findExpiredPendingOrderIds, insertSuccessfulPayment,
    issueTicket, confirmOrderAndInventory, insertEmailLog, finishEmailLog,
} from './checkout.repository.js';
import type { CreateOrderBody } from './checkout.schema.js';
import { createTicketQrDataUrl } from '../../services/qr.service.js';
import { sendTicketEmail } from '../../services/mail.service.js';
import { assertEmailVerified, consumeEmailVerification } from '../../services/email-verification.service.js';

const HOLD_MINUTES = 10;

function generateOrderCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `TBQ-${y}${m}${d}-${suffix}`;
}

function generateLookupToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
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

export async function createOrder(body: CreateOrderBody) {
    assertEmailVerified(body.buyer.email, body.emailVerificationToken);
    const { raw: lookupTokenRaw, hash: lookupTokenHash } = generateLookupToken();
    const idempotencyKey = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

    const orderId = await withTransaction(async (conn) => {
        const event = await findEventForOrder(conn, body.eventId);
        if (!event || event.status !== 'published') {
            throw AppError.badRequest('Sự kiện không tồn tại hoặc chưa mở bán', 'EVENT_NOT_AVAILABLE');
        }

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

        return newOrderId;
    });

    const order = await findOrderByIdReadOnly(orderId);
    const items = await findOrderItemsByOrderId(orderId);
    if (!order) throw AppError.notFound('Không tìm thấy đơn hàng vừa tạo');
    consumeEmailVerification(body.emailVerificationToken);
    return mapOrderResponse(order, items, lookupTokenRaw);
}

/** Nếu order đang pending mà đã quá expires_at thì chuyển sang expired ngay lúc đọc,
 *  không cần đợi job nền -> người dùng luôn thấy trạng thái đúng khi F5/gọi lại API. */
async function expireIfNeeded(orderId: number) {
    await withTransaction(async (conn) => {
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order) return;
        if (order.status === 'pending_payment' && order.expires_at && order.expires_at.getTime() <= Date.now()) {
            await expireOrder(conn, order.id);
        }
    });
}

export async function getOrderByLookupToken(orderId: number, token: string) {
    await expireIfNeeded(orderId);

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
        await expireIfNeeded(id);
    }
    return ids.length;
}

export async function payOrder(orderId: number, token: string) {
    // Chốt trạng thái hết hạn trước khi mở transaction thanh toán để vé được nhả
    // ngay cả khi người dùng bấm nút đúng lúc đồng hồ vừa về 00:00.
    await expireIfNeeded(orderId);
    const issued = await withTransaction(async (conn) => {
        const order = await findOrderByIdForUpdate(conn, orderId);
        if (!order) throw AppError.notFound('Không tìm thấy đơn hàng');

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        if (tokenHash !== order.lookup_token_hash) throw AppError.notFound('Không tìm thấy đơn hàng');
        if (order.status !== 'pending_payment') {
            throw AppError.badRequest(order.status === 'confirmed' ? 'Đơn hàng đã được thanh toán' : 'Đơn hàng không còn hiệu lực', 'ORDER_NOT_PAYABLE');
        }
        if (!order.expires_at || order.expires_at.getTime() <= Date.now()) {
            await expireOrder(conn, order.id);
            throw AppError.badRequest('Đơn hàng đã hết 10 phút giữ vé', 'ORDER_EXPIRED');
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
                    holderName: order.buyer_name,
                    holderEmail: order.buyer_email,
                });
                tickets.push({ ticketCode, ticketTypeName: item.ticket_type_name, rawToken });
            }
        }
        return { order, tickets };
    });

    const tickets = await Promise.all(issued.tickets.map(async (ticket) => ({
        ticketCode: ticket.ticketCode,
        ticketTypeName: ticket.ticketTypeName,
        qrDataUrl: await createTicketQrDataUrl(ticket.rawToken),
    })));

    let emailSent = false;
    let emailMessage = 'Vé đã được tạo nhưng chưa gửi được email';
    const emailLogId = await insertEmailLog(issued.order.id, issued.order.buyer_email);
    try {
        const info = await sendTicketEmail({
            recipient: issued.order.buyer_email,
            buyerName: issued.order.buyer_name,
            orderCode: issued.order.order_code,
            tickets,
        });
        emailSent = true;
        emailMessage = `Đã gửi ${tickets.length} vé đến ${issued.order.buyer_email}`;
        await finishEmailLog(emailLogId, true, info.messageId);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Gmail từ chối nhận thư';
        emailMessage = message;
        await finishEmailLog(emailLogId, false, undefined, message);
    }

    return {
        orderId: issued.order.id,
        orderCode: issued.order.order_code,
        status: 'confirmed' as const,
        buyerEmail: issued.order.buyer_email,
        emailSent,
        emailMessage,
        tickets,
    };
}
