import { expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn(async () => ({ messageId: 'test' })));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: send }) } }));
vi.mock('../src/config/env.js', () => ({ env: { MAIL_USER: 'sender@example.com', MAIL_APP_PASSWORD: 'test-only', MAIL_FROM_NAME: 'TicketBox' } }));
import { sendTicketEmail } from '../src/services/mail.service.js';

it('includes escaped event details, both times, ticket type and an inline QR for every ticket', async () => {
    await sendTicketEmail({ recipient: 'buyer@example.com', buyerName: '<Buyer>', orderCode: 'ORDER-1', tickets: [
        { ticketCode: 'T1', ticketTypeName: 'VIP', eventName: '<Concert>', venue: 'Hall & Stage', startTime: new Date('2026-09-22T12:00:00Z'), endTime: new Date('2026-09-22T15:00:00Z'), qrDataUrl: 'data:image/png;base64,dGVzdA==' },
        { ticketCode: 'T2', ticketTypeName: 'Standard', eventName: 'Concert Two', venue: 'Venue Two', startTime: new Date('2026-09-23T12:00:00Z'), endTime: new Date('2026-09-23T15:00:00Z'), qrDataUrl: 'data:image/png;base64,dGVzdA==' },
    ] });
    const message = send.mock.calls[0]![0];
    expect(message.html).toContain('&lt;Concert&gt;');
    expect(message.html).toContain('Hall &amp; Stage');
    expect(message.html).toContain('Concert Two');
    expect(message.html).toContain('Venue Two');
    expect(message.html).toContain('19:00');
    expect(message.html).toContain('22:00');
    expect(message.html).toContain('VIP');
    expect(message.html).toContain('T2');
    expect(message.attachments).toHaveLength(2);
});
