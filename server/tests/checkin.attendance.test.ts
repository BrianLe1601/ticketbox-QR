/// <reference path="../src/types/express.d.ts" />
// Ticket type in scan results (purchase snapshot) and the read-only gate attendance endpoint.
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  transaction: vi.fn(), listEvents: vi.fn(), lockEvent: vi.fn(), hasAssignment: vi.fn(),
  databaseNow: vi.fn(), findTicket: vi.fn(), lockOrder: vi.fn(), lockTicket: vi.fn(),
  markCheckedIn: vi.fn(), appendLog: vi.fn(), recentLogs: vi.fn(), listAssignments: vi.fn(),
  findAssignment: vi.fn(), assignmentLogs: vi.fn(), assignmentLogCount: vi.fn(),
  isOpenAssignedEvent: vi.fn(), hasActiveAssignment: vi.fn(), attendance: vi.fn(),
}));
vi.mock('../src/modules/checkins/checkin.repository.js', () => repo);
vi.mock('../src/middlewares/authenticate.js', () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers.authorization) { res.status(401).json({ success: false }); return; }
    req.authUser = { id: 2, fullName: 'Gate', email: 'gate@example.com', role: req.headers.authorization === 'admin' ? 'admin' : 'staff' };
    next();
  },
}));

import { checkIn, getAttendance } from '../src/modules/checkins/checkin.service.js';
import { checkinRouter } from '../src/modules/checkins/checkin.routes.js';
import { errorHandler } from '../src/middlewares/error-handler.js';

const now = new Date('2026-09-15T08:00:00Z');
const event = { id: 1, status: 'ongoing', checkinStartAt: new Date('2026-09-15T07:00:00Z'), checkinEndAt: new Date('2026-09-15T09:00:00Z') };
const found = { id: 10, orderId: 20, eventId: 1, code: 'TKT-123', holderName: 'Guest', ticketTypeName: 'VIP', status: 'issued', checkedInAt: null };
const locked = { id: 10, code: 'TKT-123', holderName: 'Guest', status: 'issued', checkedInAt: null }; // lockTicket: Ticket row only

beforeEach(() => {
  vi.resetAllMocks();
  repo.transaction.mockImplementation((work) => work({}));
  repo.lockEvent.mockResolvedValue(event);
  repo.hasAssignment.mockResolvedValue(true);
  repo.databaseNow.mockResolvedValue(now);
  repo.findTicket.mockResolvedValue(found);
  repo.lockOrder.mockResolvedValue('confirmed');
  repo.lockTicket.mockResolvedValue(locked);
  repo.markCheckedIn.mockResolvedValue(true);
  repo.appendLog.mockResolvedValue(undefined);
});

describe('ticket type in scan results', () => {
  it('shows the purchase snapshot on success and on an already used ticket', async () => {
    expect((await checkIn(1, 2, 'TKT-123')).ticket).toMatchObject({ code: 'TKT-123', ticketTypeName: 'VIP' });
    repo.lockTicket.mockResolvedValue({ ...locked, status: 'checked_in', checkedInAt: now });
    expect(await checkIn(1, 2, 'TKT-123')).toMatchObject({ code: 'ALREADY_CHECKED_IN', ticket: { ticketTypeName: 'VIP' } });
  });
  it('never reveals another Event\'s ticket (WRONG_EVENT) and is null for unknown codes', async () => {
    repo.findTicket.mockResolvedValue({ ...found, eventId: 99 });
    expect(await checkIn(1, 2, 'TKT-123')).toMatchObject({ code: 'WRONG_EVENT', ticket: null });
    repo.findTicket.mockResolvedValue(undefined);
    expect(await checkIn(1, 2, 'TKT-404')).toMatchObject({ code: 'INVALID', ticket: null });
  });
  it('a ticket without a snapshot name reads null, and the lock order is unchanged', async () => {
    repo.findTicket.mockResolvedValue({ ...found, ticketTypeName: undefined });
    expect((await checkIn(1, 2, 'TKT-123')).ticket?.ticketTypeName).toBeNull();
    expect(repo.lockEvent.mock.invocationCallOrder[0]).toBeLessThan(repo.lockOrder.mock.invocationCallOrder[0]!);
    expect(repo.lockOrder.mock.invocationCallOrder[0]).toBeLessThan(repo.lockTicket.mock.invocationCallOrder[0]!);
  });
});

describe('gate attendance', () => {
  it('answers only for an open gate of the authenticated Staff member', async () => {
    repo.isOpenAssignedEvent.mockResolvedValue(true);
    repo.attendance.mockResolvedValue({ admitted: 12, validTickets: 200, remaining: 188 });
    await expect(getAttendance(1, 2)).resolves.toEqual({ admitted: 12, validTickets: 200, remaining: 188 });
    expect(repo.isOpenAssignedEvent).toHaveBeenCalledWith(2, 1);
    expect(repo.attendance).toHaveBeenCalledWith(1);
  });
  it('refuses an unassigned Staff member (403) and a closed gate (409) without counting', async () => {
    repo.isOpenAssignedEvent.mockResolvedValue(false);
    repo.hasActiveAssignment.mockResolvedValue(false);
    await expect(getAttendance(1, 2)).rejects.toMatchObject({ statusCode: 403, code: 'STAFF_NOT_ASSIGNED' });
    repo.hasActiveAssignment.mockResolvedValue(true);
    await expect(getAttendance(1, 2)).rejects.toMatchObject({ statusCode: 409, code: 'EVENT_NOT_AVAILABLE' });
    expect(repo.attendance).not.toHaveBeenCalled();
    expect(repo.transaction).not.toHaveBeenCalled(); // read-only: no locking transaction
  });
  it('route: Staff only, validated Event id, authenticated identity', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/staff', checkinRouter);
    app.use(errorHandler);
    repo.isOpenAssignedEvent.mockResolvedValue(true);
    repo.attendance.mockResolvedValue({ admitted: 1, validTickets: 2, remaining: 1 });
    expect((await request(app).get('/api/staff/events/1/attendance')).status).toBe(401);
    expect((await request(app).get('/api/staff/events/1/attendance').set('Authorization', 'admin')).status).toBe(403);
    expect((await request(app).get('/api/staff/events/abc/attendance').set('Authorization', 'staff')).status).toBe(400);
    const ok = await request(app).get('/api/staff/events/1/attendance').set('Authorization', 'staff');
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true, data: { admitted: 1, validTickets: 2, remaining: 1 } });
    expect(repo.isOpenAssignedEvent).toHaveBeenCalledWith(2, 1);
  });
});
