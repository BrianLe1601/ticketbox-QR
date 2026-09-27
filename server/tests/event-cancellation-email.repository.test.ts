import { beforeEach, expect, it, vi } from 'vitest';

const pool = vi.hoisted(() => ({ query: vi.fn() }));
const transaction = vi.hoisted(() => vi.fn());
vi.mock('../src/database/pool.js', () => ({ pool }));
vi.mock('../src/modules/checkout/checkout.repository.js', () => ({ withTransaction: transaction }));

import { claimDueEventCancellationEmails, markEventCancellationEmailSent } from '../src/modules/events/event-cancellation-email.repository.js';

const connection = { query: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (work: (conn: typeof connection) => Promise<unknown>) => work(connection));
});

it('claims cancellation emails with row locks and a per-attempt lease', async () => {
  const job = { id: 4, order_id: 9, recipient: 'buyer@example.com', attempt_count: 0 };
  connection.query.mockResolvedValueOnce([[job]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
  const result = await claimDueEventCancellationEmails(20);

  expect(connection.query.mock.calls[0]![0]).toContain('FOR UPDATE SKIP LOCKED');
  expect(connection.query.mock.calls[1]![0]).toContain("status = 'processing'");
  expect(connection.query.mock.calls[1]![0]).toContain('attempt_count = attempt_count + 1');
  expect(connection.query.mock.calls[1]![0]).toContain('INTERVAL 5 MINUTE');
  expect(result[0]?.attempt_count).toBe(1);
});

it('fences completion by status, attempt and unexpired lease', async () => {
  pool.query.mockResolvedValue([{ affectedRows: 1 }]);
  await expect(markEventCancellationEmailSent(4, 2, 'provider')).resolves.toBe(true);
  const [sql, params] = pool.query.mock.calls[0]!;
  expect(sql).toContain("status = 'processing'");
  expect(sql).toContain('attempt_count = ?');
  expect(sql).toContain('next_attempt_at > NOW(3)');
  expect(params).toEqual(['provider', 4, 2]);
});
