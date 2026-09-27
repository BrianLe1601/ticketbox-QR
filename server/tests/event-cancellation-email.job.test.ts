import { beforeEach, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ claim: vi.fn(), sent: vi.fn(), failed: vi.fn(), recover: vi.fn() }));
const send = vi.hoisted(() => vi.fn());
vi.mock('../src/modules/events/event-cancellation-email.repository.js', () => ({
  claimDueEventCancellationEmails: repo.claim,
  markEventCancellationEmailSent: repo.sent,
  markEventCancellationEmailFailed: repo.failed,
  recoverStaleEventCancellationEmails: repo.recover,
}));
vi.mock('../src/services/mail.service.js', () => ({ sendEventCancellationEmail: send }));

import { processEventCancellationEmailBatch } from '../src/jobs/event-cancellation-email.job.js';

const job = {
  id: 4, order_id: 9, recipient: 'buyer@example.com', attempt_count: 1, order_code: 'ORDER-9', buyer_name: 'Buyer',
  event_name: 'Event', venue: 'Hall', start_time: new Date(), cancellation_reason: 'Weather',
};
beforeEach(() => {
  vi.resetAllMocks(); repo.claim.mockResolvedValue([job]); repo.sent.mockResolvedValue(true); repo.failed.mockResolvedValue(true);
});

it('recovers stale leases before claiming and marks accepted mail sent', async () => {
  send.mockResolvedValue({ messageId: 'provider', accepted: [job.recipient] });
  await processEventCancellationEmailBatch();
  expect(repo.recover).toHaveBeenCalledOnce();
  expect(repo.claim).toHaveBeenCalledWith(20);
  expect(repo.sent).toHaveBeenCalledWith(4, 1, 'provider');
  expect(repo.failed).not.toHaveBeenCalled();
});

it('persists only a safe failure classification and retries temporary failures', async () => {
  send.mockRejectedValue({ code: 'ETIMEDOUT', message: 'recipient and secret must not be persisted' });
  await processEventCancellationEmailBatch();
  const args = repo.failed.mock.calls[0]!;
  expect(args[0]).toBe(4); expect(args[1]).toBe(1);
  expect(args[2]).toContain('EMAIL_PROVIDER_TEMPORARY');
  expect(args[2]).not.toContain('secret');
  expect(args[3]).toBeInstanceOf(Date);
});
