import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); vi.stubEnv('RECAPTCHA_SECRET_KEY', 'test-secret'); vi.stubEnv('RECAPTCHA_MIN_SCORE', '0.5'); vi.stubEnv('RECAPTCHA_HOSTNAME', 'tickets.test'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('public email security', () => {
    it('accepts only the expected action, hostname and sufficient score', async () => {
        const { verifyRecaptcha } = await import('../src/services/public-email-security.service.js');
        const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
        for (const data of [
            { success: false, score: 1, action: 'ticket_retrieval', hostname: 'tickets.test' },
            { success: true, score: 0.49, action: 'ticket_retrieval', hostname: 'tickets.test' },
            { success: true, score: 1, action: 'checkout_email', hostname: 'tickets.test' },
            { success: true, score: 1, action: 'ticket_retrieval', hostname: 'wrong.test' },
            { success: true, action: 'ticket_retrieval', hostname: 'tickets.test' },
        ]) {
            fetchMock.mockResolvedValue({ ok: true, json: async () => data });
            await expect(verifyRecaptcha('token', 'ticket_retrieval', '127.0.0.1')).rejects.toMatchObject({ code: 'REQUEST_REJECTED' });
        }
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, score: 0.5, action: 'ticket_retrieval', hostname: 'tickets.test' }) });
        await expect(verifyRecaptcha('token', 'ticket_retrieval', '127.0.0.1')).resolves.toBeUndefined();
        fetchMock.mockRejectedValue(new Error('network'));
        await expect(verifyRecaptcha('token', 'ticket_retrieval', '127.0.0.1')).rejects.toMatchObject({ code: 'REQUEST_REJECTED' });
    });
    it('limits both normalized email and IP, expires after 60 seconds and isolates flows', async () => {
        vi.useFakeTimers();
        const { enforceEmailRateLimit } = await import('../src/services/public-email-security.service.js');
        enforceEmailRateLimit('retrieval', 'Buyer@example.com', 'ip1');
        expect(() => enforceEmailRateLimit('retrieval', 'buyer@example.com', 'ip2')).toThrow(expect.objectContaining({ code: 'RATE_LIMITED', retryAfterSeconds: 60 }));
        expect(() => enforceEmailRateLimit('retrieval', 'other@example.com', 'ip1')).toThrow();
        expect(() => enforceEmailRateLimit('checkout', 'buyer@example.com', 'ip1')).not.toThrow();
        vi.advanceTimersByTime(60001);
        expect(() => enforceEmailRateLimit('retrieval', 'buyer@example.com', 'ip1')).not.toThrow();
    });
});
