import { createHash, timingSafeEqual } from 'node:crypto';
import { findOrderDetail, findTicketsForResend } from '../modules/orders/admin-orders.repository.js';
import { markTicketEmailFailed, markTicketEmailSent } from '../modules/tickets/ticket-email.repository.js';
import type { TicketEmailJob } from '../modules/tickets/ticket-email.repository.js';
import { decryptQrToken } from './qr-encryption.service.js';
import { createTicketQrDataUrl } from './qr.service.js';
import { sendTicketEmail } from './mail.service.js';
import { AppError } from '../utils/app-error.js';

export async function prepareTicketEmail(orderId: number) {
    const order = await findOrderDetail(orderId);
    if (!order || order.status !== 'confirmed') throw AppError.badRequest('Order is not confirmed', 'ORDER_NOT_CONFIRMED');
    const rows = await findTicketsForResend(orderId);
    if (!rows.length) throw AppError.badRequest('No unused tickets remain', 'NO_ACTIVE_TICKETS');
    const tickets = await Promise.all(rows.map(async row => {
        if (!row.qr_token_encrypted) throw new AppError(409, 'Original QR payload is unavailable; legacy ticket requires separate recovery', 'QR_PAYLOAD_UNAVAILABLE');
        const rawToken = decryptQrToken(row.qr_token_encrypted, row.ticket_code);
        const actual = createHash('sha256').update(rawToken).digest();
        const expected = Buffer.from(row.qr_token_hash, 'hex');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AppError(500, 'Recovered QR does not match stored credential', 'QR_HASH_MISMATCH');
        return { ticketCode: row.ticket_code, ticketTypeName: row.ticket_type_name,
            eventName: row.event_name, startTime: row.start_time, endTime: row.end_time, venue: row.venue,
            qrDataUrl: await createTicketQrDataUrl(rawToken) };
    }));
    return { recipient: order.buyer_email, buyerName: order.buyer_name, orderCode: order.order_code, tickets };
}

const retryMinutes = [1, 5, 15, 60];
export function classifyTicketEmailError(error: unknown) {
    if (error instanceof AppError) return { code: error.code, message: error.message, retryable: false };
    const smtp = error as { code?: string; responseCode?: number } | null;
    const transient = ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ESOCKET'].includes(smtp?.code ?? '')
        || (typeof smtp?.responseCode === 'number' && smtp.responseCode >= 400 && smtp.responseCode < 500);
    // Provider exceptions can contain credentials/recipient/token fragments. Persist only safe classifications.
    return { code: transient ? 'EMAIL_PROVIDER_TEMPORARY' : 'EMAIL_PROVIDER_FAILED',
        message: transient ? 'Temporary SMTP connection or delivery failure' : 'SMTP delivery failed; check provider configuration and recipient', retryable: transient };
}

export async function deliverTicketEmailJob(job: TicketEmailJob) {
    let providerId: string;
    try {
        const mail = await prepareTicketEmail(job.order_id);
        if (mail.recipient !== job.recipient) throw new AppError(409, 'Email recipient does not match order', 'EMAIL_RECIPIENT_MISMATCH');
        const result = await sendTicketEmail(mail);
        if (!result.accepted?.some(address => (typeof address === 'string' ? address : address.address)?.toLowerCase() === job.recipient.toLowerCase())) {
            throw new AppError(502, 'SMTP did not accept recipient', 'EMAIL_RECIPIENT_REJECTED');
        }
        providerId = result.messageId;
    } catch (error) {
        const failure = classifyTicketEmailError(error);
        const delay = retryMinutes[job.attempt_count - 1];
        const next = failure.retryable && job.attempt_count < 5 && delay !== undefined ? new Date(Date.now() + delay * 60_000) : null;
        await markTicketEmailFailed(job.id, job.attempt_count, `${failure.code}: ${failure.message}`, next);
        console.error('Ticket email attempt failed', { jobId: job.id, orderId: job.order_id, attempt: job.attempt_count, code: failure.code });
        return;
    }
    // A DB failure after SMTP acceptance is not a provider failure. Leave lease recovery to the queue.
    if (!await markTicketEmailSent(job.id, job.attempt_count, providerId)) {
        console.error('Ticket email completion lost lease', { jobId: job.id, attempt: job.attempt_count });
    }
}
