import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const repo = vi.hoisted(() => ({
  transaction: vi.fn(), listEvents: vi.fn(), lockEvent: vi.fn(), hasAssignment: vi.fn(),
  databaseNow: vi.fn(), findTicket: vi.fn(), lockOrder: vi.fn(), lockTicket: vi.fn(),
  markCheckedIn: vi.fn(), appendLog: vi.fn(), recentLogs: vi.fn(),
}));
vi.mock('../src/modules/checkins/checkin.repository.js', () => repo);
import { checkIn, getRecentLogs } from '../src/modules/checkins/checkin.service.js';

const now = new Date('2026-09-15T08:00:00Z');
const ticket = { id: 10, orderId: 20, eventId: 1, code: 'TKT-123', holderName: 'Guest', status: 'issued', checkedInAt: null };
const event = { id: 1, status: 'ongoing', checkinStartAt: new Date('2026-09-15T07:00:00Z'), checkinEndAt: new Date('2026-09-15T09:00:00Z') };
beforeEach(() => {
  vi.resetAllMocks();
  repo.transaction.mockImplementation((work) => work({}));
  repo.lockEvent.mockResolvedValue(event);
  repo.hasAssignment.mockResolvedValue(true);
  repo.databaseNow.mockResolvedValue(now);
  repo.findTicket.mockResolvedValue(ticket);
  repo.lockOrder.mockResolvedValue('confirmed');
  repo.lockTicket.mockResolvedValue(ticket);
  repo.markCheckedIn.mockResolvedValue(true);
  repo.appendLog.mockResolvedValue(undefined);
});
describe('check-in business rules', () => {
  it('accepts issued tickets and records success after changing state', async () => {
    const result = await checkIn(1, 2, ' TKT-123 ');
    expect(result.code).toBe('SUCCESS');
    expect(result.ticket?.checkedInAt).toEqual(now);
    expect(repo.markCheckedIn).toHaveBeenCalledWith(expect.anything(), 10, 2, now);
    expect(repo.appendLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: 'SUCCESS', ticketId: 10 }));
    expect(repo.lockEvent.mock.invocationCallOrder[0]).toBeLessThan(repo.lockOrder.mock.invocationCallOrder[0]!);
    expect(repo.lockOrder.mock.invocationCallOrder[0]).toBeLessThan(repo.lockTicket.mock.invocationCallOrder[0]!);
    expect(repo.markCheckedIn.mock.invocationCallOrder[0]).toBeLessThan(repo.appendLog.mock.invocationCallOrder[0]!);
  });
  it('hashes the exact QR credential and never logs the raw credential', async () => {
    const raw = 'a'.repeat(64);
    await checkIn(1, 2, `ticketbox:${raw}`);
    expect(repo.findTicket).toHaveBeenCalledWith(expect.anything(), createHash('sha256').update(raw).digest('hex'), true);
    const log = repo.appendLog.mock.calls[0]![1];
    expect(JSON.stringify(log)).not.toContain(raw);
    expect(log.masked).toMatch(/^\*\*\*[a-f0-9]{8}$/);
  });
  it('logs malformed QR without a ticket lookup', async () => {
    expect((await checkIn(1, 2, 'ticketbox:bad')).code).toBe('INVALID');
    expect(repo.findTicket).not.toHaveBeenCalled();
    expect(repo.appendLog).toHaveBeenCalled();
  });
  it('records unassigned attempts without exposing ticket data', async () => {
    repo.hasAssignment.mockResolvedValue(false);
    expect(await checkIn(1, 2, 'TKT-123')).toMatchObject({ code: 'STAFF_NOT_ASSIGNED', ticket: null });
    expect(repo.findTicket).not.toHaveBeenCalled();
    expect(repo.appendLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ticketId: null, code: 'STAFF_NOT_ASSIGNED' }));
  });
  it('does not disclose holder information on a wrong-event ticket', async () => {
    repo.findTicket.mockResolvedValue({ ...ticket, eventId: 9 });
    expect(await checkIn(1, 2, 'TKT-123')).toMatchObject({ code: 'WRONG_EVENT', ticket: null });
    expect(repo.lockOrder).not.toHaveBeenCalled();
    expect(repo.markCheckedIn).not.toHaveBeenCalled();
  });
  it.each(['draft', 'completed', 'cancelled'])('rejects Event %s', async (status) => {
    repo.lockEvent.mockResolvedValue({ ...event, status });
    expect((await checkIn(1, 2, 'TKT-123')).code).toBe('EVENT_NOT_AVAILABLE');
    expect(repo.markCheckedIn).not.toHaveBeenCalled();
  });
  it.each(['2026-09-15T06:59:59Z', '2026-09-15T09:00:01Z'])('rejects outside the check-in window: %s', async (clock) => {
    repo.databaseNow.mockResolvedValue(new Date(clock));
    expect((await checkIn(1, 2, 'TKT-123')).code).toBe('EVENT_NOT_AVAILABLE');
  });
  it('rechecks the clock after waiting for locks', async () => {
    repo.databaseNow.mockResolvedValueOnce(now).mockResolvedValue(new Date('2026-09-15T09:00:01Z'));
    expect((await checkIn(1, 2, 'TKT-123')).code).toBe('EVENT_NOT_AVAILABLE');
    expect(repo.markCheckedIn).not.toHaveBeenCalled();
  });
  it.each([['checked_in', 'ALREADY_CHECKED_IN'], ['cancelled', 'CANCELLED']])('rejects ticket state %s and commits a denial log', async (status, code) => {
    repo.lockTicket.mockResolvedValue({ ...ticket, status });
    expect((await checkIn(1, 2, 'TKT-123')).code).toBe(code);
    expect(repo.markCheckedIn).not.toHaveBeenCalled();
    expect(repo.appendLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code }));
  });
  it('rejects unpaid tickets', async () => {
    repo.lockOrder.mockResolvedValue('pending_payment');
    expect((await checkIn(1, 2, 'TKT-123')).code).toBe('UNPAID');
    expect(repo.markCheckedIn).not.toHaveBeenCalled();
  });
  it('logs unknown manual codes', async () => {
    repo.findTicket.mockResolvedValue(undefined);
    expect((await checkIn(1, 2, 'fake')).code).toBe('INVALID');
    expect(repo.appendLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ticketId: null, code: 'INVALID' }));
  });
  it('fails the transaction if audit persistence fails', async () => {
    repo.appendLog.mockRejectedValue(new Error('audit unavailable'));
    await expect(checkIn(1, 2, 'TKT-123')).rejects.toThrow('audit unavailable');
  });
  it('does not report success after an unsuccessful conditional update', async () => {
    repo.markCheckedIn.mockResolvedValue(false);
    await expect(checkIn(1, 2, 'TKT-123')).rejects.toMatchObject({ code: 'CHECKIN_CONFLICT' });
    expect(repo.appendLog).not.toHaveBeenCalled();
  });
  it('requires an existing Event before inserting an audit row', async () => {
    repo.lockEvent.mockResolvedValue(undefined);
    await expect(checkIn(1, 2, 'TKT-123')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.appendLog).not.toHaveBeenCalled();
  });
  it('blocks log access when an assignment has been revoked', async () => {
    repo.hasAssignment.mockResolvedValue(false);
    await expect(getRecentLogs(1, 2)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.recentLogs).not.toHaveBeenCalled();
  });
});
