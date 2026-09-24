import crypto from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ order: vi.fn(), tickets: vi.fn(), sent: vi.fn(), failed: vi.fn(), send: vi.fn(), qr: vi.fn() }));
vi.mock('../src/config/env.js', () => ({ env: { QR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), QR_ENCRYPTION_KEY_ID: 'test' } }));
vi.mock('../src/modules/orders/admin-orders.repository.js', () => ({ findOrderDetail: mock.order, findTicketsForResend: mock.tickets }));
vi.mock('../src/modules/tickets/ticket-email.repository.js', () => ({ markTicketEmailSent: mock.sent, markTicketEmailFailed: mock.failed }));
vi.mock('../src/services/mail.service.js', () => ({ sendTicketEmail: mock.send }));
vi.mock('../src/services/qr.service.js', () => ({ createTicketQrDataUrl: mock.qr }));
import { encryptQrToken } from '../src/services/qr-encryption.service.js';
import { deliverTicketEmailJob, prepareTicketEmail } from '../src/services/ticket-email.service.js';
import type { TicketEmailJob } from '../src/modules/tickets/ticket-email.repository.js';
const token = 'b'.repeat(64);
const job = { id: 1, order_id: 2, recipient: 'buyer@example.com', email_type: 'ticket_resent', status: 'processing', attempt_count: 1 } as TicketEmailJob;
function ticket() { return { ticket_code: 'T1', ticket_type_name: 'VIP', qr_token_hash: crypto.createHash('sha256').update(token).digest('hex'), qr_token_encrypted: encryptQrToken(token, 'T1'), event_name: 'Event', venue: 'Hall', start_time: new Date(), end_time: new Date() }; }
beforeEach(() => {
    vi.clearAllMocks(); mock.order.mockResolvedValue({ status: 'confirmed', buyer_email: job.recipient, buyer_name: 'Buyer', order_code: 'O1' });
    mock.tickets.mockResolvedValue([ticket()]); mock.qr.mockResolvedValue('original-qr');
    mock.send.mockResolvedValue({ messageId: 'provider', accepted: [job.recipient] }); mock.sent.mockResolvedValue(true);
});
it('resend and initial delivery use exactly the original credential and event metadata', async () => {
    await deliverTicketEmailJob(job); await deliverTicketEmailJob({ ...job, email_type: 'ticket_issued' });
    expect(mock.qr).toHaveBeenNthCalledWith(1, token); expect(mock.qr).toHaveBeenNthCalledWith(2, token);
    expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({ tickets: [expect.objectContaining({ qrDataUrl: 'original-qr', eventName: 'Event', venue: 'Hall' })] }));
    expect(mock.sent).toHaveBeenCalledWith(1, 1, 'provider');
});
it('refuses a legacy/mismatched credential and sends no partial email', async () => {
    for (const [row, code] of [[{ ...ticket(), qr_token_encrypted: null }, 'QR_PAYLOAD_UNAVAILABLE'], [{ ...ticket(), qr_token_hash: '0'.repeat(64) }, 'QR_HASH_MISMATCH']] as const) {
        mock.tickets.mockResolvedValue([ticket(), row]); await deliverTicketEmailJob(job);
        expect(mock.failed).toHaveBeenLastCalledWith(1, 1, expect.stringContaining(code), null);
    }
    expect(mock.send).not.toHaveBeenCalled();
});
it('refuses orders not confirmed and orders without eligible issued tickets', async () => {
    mock.order.mockResolvedValue({ status: 'pending_payment' }); await expect(prepareTicketEmail(2)).rejects.toMatchObject({ code: 'ORDER_NOT_CONFIRMED' });
    mock.order.mockResolvedValue({ status: 'confirmed' }); mock.tickets.mockResolvedValue([]);
    await expect(prepareTicketEmail(2)).rejects.toMatchObject({ code: 'NO_ACTIVE_TICKETS' }); expect(mock.send).not.toHaveBeenCalled();
});
it('retries only temporary SMTP failures at 1/5/15/60 minutes and stops at five attempts', async () => {
    mock.send.mockRejectedValue({ code: 'ETIMEDOUT', message: 'unsafe provider data' });
    for (let attempt = 1; attempt <= 5; attempt++) {
        const before = Date.now(); await deliverTicketEmailJob({ ...job, attempt_count: attempt });
        const args = mock.failed.mock.calls.at(-1)!;
        expect(args[2]).not.toContain('unsafe provider data');
        if (attempt === 5) expect(args[3]).toBeNull();
        else expect(args[3].getTime() - before).toBeGreaterThanOrEqual([1, 5, 15, 60][attempt - 1]! * 60_000);
    }
    mock.send.mockRejectedValue({ code: 'EAUTH', responseCode: 535 }); await deliverTicketEmailJob(job);
    expect(mock.failed).toHaveBeenLastCalledWith(1, 1, expect.stringContaining('EMAIL_PROVIDER_FAILED'), null);
    expect(mock.sent).not.toHaveBeenCalled();
});
it('does not mark delivery sent when SMTP did not accept the recipient', async () => {
    mock.send.mockResolvedValue({ messageId: 'not-accepted', accepted: [] }); await deliverTicketEmailJob(job);
    expect(mock.sent).not.toHaveBeenCalled(); expect(mock.failed).toHaveBeenCalledWith(1, 1, expect.stringContaining('EMAIL_RECIPIENT_REJECTED'), null);
});
