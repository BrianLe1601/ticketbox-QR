import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ find: vi.fn(), resend: vi.fn(), captcha: vi.fn() }));
vi.mock('../src/modules/tickets/ticket-retrieval.repository.js', () => ({ findConfirmedOrdersByEmail: mocks.find }));
vi.mock('../src/modules/tickets/ticket-email.repository.js', () => ({ enqueueTicketEmail: mocks.resend }));
vi.mock('../src/services/public-email-security.service.js', async (original) => ({ ...await original<object>(), verifyRecaptcha: mocks.captcha }));
import { ticketsRouter } from '../src/modules/tickets/ticket-retrieval.routes.js';
import { AppError } from '../src/utils/app-error.js';
import { retrieveTickets, retrievalMessage } from '../src/modules/tickets/ticket-retrieval.service.js';
const app = express(); app.use(express.json()); app.use('/api/tickets', ticketsRouter);
app.use(((error: AppError, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.statusCode || 500).json({ success: false, message: error.message, code: error.code })) as express.ErrorRequestHandler);
beforeEach(() => { mocks.find.mockReset(); mocks.resend.mockReset(); mocks.captcha.mockReset(); });
it('returns the same acknowledgement for an email with no orders and sends no mail', async () => {
    mocks.find.mockResolvedValue([]);
    const result = await retrieveTickets('empty@example.com', 'token', 'empty-ip');
    expect(result).toEqual({ message: retrievalMessage });
    await new Promise(resolve => setImmediate(resolve));
    expect(mocks.find).toHaveBeenCalledWith('empty@example.com');
    expect(mocks.resend).not.toHaveBeenCalled();
});
it('validates input and rejects captcha with a stable generic error', async () => {
    expect((await request(app).post('/api/tickets/retrieval').send({ email: 'bad' })).status).toBe(400);
    mocks.captcha.mockRejectedValueOnce(AppError.badRequest('Không thể xử lý yêu cầu.', 'REQUEST_REJECTED'));
    const result = await request(app).post('/api/tickets/retrieval').send({ email: 'buyer@example.com', recaptchaToken: 'token' });
    expect(result.body.code).toBe('REQUEST_REJECTED'); expect(mocks.find).not.toHaveBeenCalled();
});
it('waits for durable enqueue before acknowledgement, without sending SMTP', async () => {
    let finish!: () => void;
    mocks.find.mockResolvedValue([{ id: 1 }]);
    mocks.resend.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    let complete = false;
    const pending = retrieveTickets('queued@example.com', 'token', 'queued-ip').then(result => { complete = true; return result; });
    await vi.waitFor(() => expect(mocks.resend).toHaveBeenCalledWith(1, 'queued@example.com', 'ticket_resent'));
    expect(complete).toBe(false); finish();
    expect(await pending).toEqual({ message: retrievalMessage });
});
it('preserves 429 retry seconds after a successful enqueue', async () => {
    mocks.find.mockResolvedValue([{ id: 1 }]); mocks.resend.mockResolvedValue({ jobId: 1 });
    const accepted = await request(app).post('/api/tickets/retrieval').send({ email: 'http@example.com', recaptchaToken: 'token' });
    expect(accepted.body.success).toBe(true);
    const limited = await request(app).post('/api/tickets/retrieval').send({ email: 'other@example.com', recaptchaToken: 'token' });
    expect(limited.status).toBe(429); expect(limited.body.code).toBe('RATE_LIMITED'); expect(limited.body.retryAfterSeconds).toBeGreaterThan(0);
});
it('returns a generic service error with requestId logged when enqueue fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.find.mockResolvedValue([{ id: 1 }]); mocks.resend.mockRejectedValue(new Error('private details'));
    await expect(retrieveTickets('failed@example.com', 'token', 'failed-ip', 'request-test')).rejects.toMatchObject({ statusCode: 503, code: 'TICKET_RETRIEVAL_UNAVAILABLE' });
    expect(spy).toHaveBeenCalledWith('Ticket retrieval enqueue failed', { requestId: 'request-test', code: 'TICKET_RETRIEVAL_UNAVAILABLE' });
    spy.mockRestore();
});

it('keeps the acknowledgement neutral when all Events become unavailable before enqueue', async () => {
    mocks.find.mockResolvedValue([{ id: 1 }]);
    mocks.resend.mockRejectedValue(new AppError(409, 'private event details', 'EVENT_NOT_AVAILABLE_FOR_TICKET_EMAIL'));
    await expect(retrieveTickets('hidden-race@example.com', 'token', 'hidden-race-ip'))
        .resolves.toEqual({ message: retrievalMessage });
});

it('continues enqueueing other eligible Orders after an Event is hidden, cancelled or ends', async () => {
    mocks.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mocks.resend.mockRejectedValueOnce(new AppError(409, 'private event details', 'EVENT_NOT_AVAILABLE_FOR_TICKET_EMAIL'))
        .mockResolvedValueOnce({ jobId: 2 });
    await expect(retrieveTickets('mixed-race@example.com', 'token', 'mixed-race-ip'))
        .resolves.toEqual({ message: retrievalMessage });
    expect(mocks.resend).toHaveBeenNthCalledWith(2, 2, 'mixed-race@example.com', 'ticket_resent');
    expect(mocks.captcha).toHaveBeenCalledWith('token', 'ticket_retrieval', 'mixed-race-ip');
});

it('does not swallow unrelated application errors as an eligibility race', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
        mocks.find.mockResolvedValue([{ id: 1 }]);
        mocks.resend.mockRejectedValue(new AppError(409, 'private details', 'EMAIL_RECIPIENT_MISMATCH'));
        await expect(retrieveTickets('other-error@example.com', 'token', 'other-error-ip'))
            .rejects.toMatchObject({ statusCode: 503, code: 'TICKET_RETRIEVAL_UNAVAILABLE' });
    } finally { spy.mockRestore(); }
});
