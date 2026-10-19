import { expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn(async () => ({ messageId: 'test' })));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: send }) } }));
vi.mock('../src/config/env.js', () => ({ env: { MAIL_USER: 'sender@example.com', MAIL_APP_PASSWORD: 'test-only', MAIL_FROM_NAME: 'TicketBox' } }));
import { sendPasswordResetEmail } from '../src/services/mail.service.js';

it('password reset mail: escaped name, the fragment link, single use, Vietnam expiry time and a plain-text part', async () => {
    const link = 'http://localhost:5173/reset-password#token=7.1760000000.abc_DEF-123';
    await sendPasswordResetEmail({ recipient: 'admin@example.com', fullName: '<Admin & Co>', link, expiresAt: new Date('2026-10-19T03:30:00Z'), ttlMinutes: 30 });
    const message = send.mock.calls[0]![0] as { to: string; subject: string; html: string; text: string };
    expect(message.to).toBe('admin@example.com');
    expect(message.subject).toBe('Đặt lại mật khẩu Quản trị - TicketBox QR');
    expect(message.html).toContain('&lt;Admin &amp; Co&gt;');
    expect(message.html).toContain(`href="${link}"`);
    expect(message.html).toContain('<b>một lần</b> trong 30 phút');
    expect(message.html).toContain('10:30');
    expect(message.html).toContain('bỏ qua email này');
    expect(message.text).toContain(link);
    expect(message.html).not.toMatch(/\?token=/);
});
