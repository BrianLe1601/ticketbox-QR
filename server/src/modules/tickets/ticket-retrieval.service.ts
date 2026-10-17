import { enforceEmailRateLimit, verifyRecaptcha } from '../../services/public-email-security.service.js';
import { findConfirmedOrdersByEmail } from './ticket-retrieval.repository.js';
import { enqueueTicketEmail } from './ticket-email.repository.js';
import { AppError } from '../../utils/app-error.js';
import { randomUUID } from 'node:crypto';

export const retrievalMessage = 'Nếu email có vé hợp lệ, yêu cầu gửi lại vé đã được ghi nhận. Vui lòng kiểm tra hộp thư của bạn.';
async function deliver(email: string) {
    const orders = await findConfirmedOrdersByEmail(email);
    for (const order of orders) {
        try {
            await enqueueTicketEmail(order.id, email, 'ticket_resent');
        } catch (error) {
            // The Event can be hidden, cancelled or ended after the initial read.
            // Keep the public acknowledgement neutral; enqueue still checks under locks.
            if (error instanceof AppError && error.code === 'EVENT_NOT_AVAILABLE_FOR_TICKET_EMAIL') continue;
            throw error;
        }
    }
}
export async function retrieveTickets(email: string, token: string, ip: string, requestId = randomUUID()) {
    await verifyRecaptcha(token, 'ticket_retrieval', ip);
    enforceEmailRateLimit('retrieval', email, ip);
    try { await deliver(email); }
    catch {
        console.error('Ticket retrieval enqueue failed', { requestId, code: 'TICKET_RETRIEVAL_UNAVAILABLE' });
        throw new AppError(503, 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.', 'TICKET_RETRIEVAL_UNAVAILABLE');
    }
    return { message: retrievalMessage };
}
