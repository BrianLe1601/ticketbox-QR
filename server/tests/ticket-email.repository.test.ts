import { beforeEach, expect, it, vi } from 'vitest';

const checkout = vi.hoisted(() => ({
    withTransaction: vi.fn(),
    findOrderEventId: vi.fn(),
    lockEventRow: vi.fn(),
    findOrderByIdForUpdate: vi.fn(),
}));
vi.mock('../src/modules/checkout/checkout.repository.js', () => checkout);
vi.mock('../src/database/pool.js', () => ({ pool: { query: vi.fn() } }));

import { enqueueTicketEmail } from '../src/modules/tickets/ticket-email.repository.js';

beforeEach(() => {
    vi.resetAllMocks();
    checkout.withTransaction.mockImplementation((work: (connection: object) => Promise<unknown>) => work({}));
    checkout.findOrderEventId.mockResolvedValue(9);
});

it.each([
    { status: 'completed', visibility: 'visible', end_time: new Date(Date.now() + 60_000) },
    { status: 'published', visibility: 'visible', end_time: new Date(Date.now() - 1) },
    { status: 'published', visibility: 'hidden', end_time: new Date(Date.now() + 60_000) },
])('rejects enqueue when Event ticket delivery is no longer valid: $status', async event => {
    checkout.lockEventRow.mockResolvedValue(event);
    await expect(enqueueTicketEmail(4, 'buyer@example.com', 'ticket_resent')).rejects.toMatchObject({
        statusCode: 409,
        code: 'EVENT_NOT_AVAILABLE_FOR_TICKET_EMAIL',
    });
    expect(checkout.findOrderByIdForUpdate).not.toHaveBeenCalled();
});
