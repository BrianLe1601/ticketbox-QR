import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mail = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock('../src/services/mail.service.js', () => ({ sendEmailVerificationCode: mail }));
vi.mock('../src/services/public-email-security.service.js', () => ({ verifyRecaptcha: vi.fn(), enforceEmailRateLimit: vi.fn() }));
beforeEach(() => { vi.resetModules(); mail.mockClear(); });
afterEach(() => vi.useRealTimers());

it('binds OTP and verification token to email and checkout session, then consumes it', async () => {
    const service = await import('../src/services/email-verification.service.js');
    await service.requestEmailVerification('buyer@example.com', 'captcha', 'ip', 'session-a');
    const code = mail.mock.calls[0]![1] as string;
    expect(code).toMatch(/^\d{6}$/);
    expect(() => service.confirmEmailVerification('buyer@example.com', code, 'session-b')).toThrow();
    const { verificationToken } = service.confirmEmailVerification('buyer@example.com', code, 'session-a');
    expect(() => service.assertEmailVerified('buyer@example.com', verificationToken, 'session-b')).toThrow();
    expect(() => service.assertEmailVerified('other@example.com', verificationToken, 'session-a')).toThrow();
    expect(() => service.assertEmailVerified('buyer@example.com', verificationToken, 'session-a')).not.toThrow();
    service.consumeEmailVerification(verificationToken);
    expect(() => service.assertEmailVerified('buyer@example.com', verificationToken, 'session-a')).toThrow();
});
it('expires OTP at five minutes and rejects after five incorrect attempts', async () => {
    vi.useFakeTimers();
    const service = await import('../src/services/email-verification.service.js');
    await service.requestEmailVerification('buyer@example.com', 'captcha', 'ip', 's');
    const code = mail.mock.calls[0]![1] as string;
    const wrong = code === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 5; attempt++) expect(() => service.confirmEmailVerification('buyer@example.com', wrong, 's')).toThrow();
    expect(() => service.confirmEmailVerification('buyer@example.com', code, 's')).toThrow();
    await service.requestEmailVerification('buyer@example.com', 'captcha', 'ip', 's');
    vi.advanceTimersByTime(300001);
    expect(() => service.confirmEmailVerification('buyer@example.com', mail.mock.calls[1]![1] as string, 's')).toThrow();
});
