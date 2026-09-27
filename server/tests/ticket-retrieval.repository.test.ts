import { expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn());
vi.mock('../src/database/pool.js', () => ({ pool: { query } }));

import { findConfirmedOrdersByEmail } from '../src/modules/tickets/ticket-retrieval.repository.js';

it('selects only confirmed Orders with issued tickets for a non-ended Event', async () => {
    query.mockResolvedValueOnce([[{ id: 5 }]]);
    await expect(findConfirmedOrdersByEmail('buyer@example.com')).resolves.toEqual([{ id: 5 }]);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain("o.status = 'confirmed'");
    expect(sql).toContain("e.status IN ('published', 'ongoing')");
    expect(sql).toContain('e.end_time > NOW(3)');
    expect(sql).toContain("t.status = 'issued'");
    expect(params).toEqual(['buyer@example.com']);
});
