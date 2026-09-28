import { createHash } from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import * as repo from './checkin.repository.js';
import { resultMessages } from './checkin.types.js';
import type { ResultCode, ScanResult } from './checkin.types.js';
import type { AssignmentListQuery, AssignmentLogsQuery } from './checkin.schema.js';

const hashCode = (value: string) => createHash('sha256').update(value).digest('hex');
export const getAssignedEvents = repo.listEvents;

function mapAssignment(row: repo.AssignmentRow) {
  return {
    assignmentId: row.assignmentId,
    eventId: row.id,
    name: row.name,
    venue: row.venue,
    address: row.address,
    city: row.city,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    checkinStartAt: row.checkinStartAt,
    checkinEndAt: row.checkinEndAt,
    assignedAt: row.assignedAt,
    revokedAt: row.revokedAt,
    isActive: Boolean(row.isActive),
    operationalState: row.operationalState,
  };
}

export async function getAssignments(staffId: number, query: AssignmentListQuery) {
  const { rows, total } = await repo.listAssignments(staffId, query);
  return { data: rows.map(mapAssignment), meta: { total, page: query.page, limit: query.limit } };
}

export async function getAssignment(staffId: number, assignmentId: number) {
  const row = await repo.findAssignment(staffId, assignmentId);
  if (!row) throw AppError.notFound('Không tìm thấy phân công.', 'STAFF_ASSIGNMENT_NOT_FOUND');
  return mapAssignment(row);
}

export async function getAssignmentLogs(staffId: number, assignmentId: number, query: AssignmentLogsQuery) {
  if (!await repo.findAssignment(staffId, assignmentId)) {
    throw AppError.notFound('Không tìm thấy phân công.', 'STAFF_ASSIGNMENT_NOT_FOUND');
  }
  const [data, total] = await Promise.all([
    repo.assignmentLogs(staffId, assignmentId, query),
    repo.assignmentLogCount(staffId, assignmentId, query),
  ]);
  return { data, meta: { total, page: query.page, limit: query.limit } };
}

export async function getOverview(staffId: number) {
  const [open, upcoming, history] = await Promise.all([
    getAssignments(staffId, { segment: 'open', page: 1, limit: 4 }),
    getAssignments(staffId, { segment: 'upcoming', page: 1, limit: 1 }),
    getAssignments(staffId, { segment: 'history', page: 1, limit: 1 }),
  ]);
  return {
    counts: { open: open.meta.total, upcoming: upcoming.meta.total, history: history.meta.total, total: open.meta.total + upcoming.meta.total + history.meta.total },
    openEvents: open.data,
    nextUpcomingAssignment: upcoming.data[0] ?? null,
  };
}

export async function getRecentLogs(eventId: number, staffId: number) {
  return repo.transaction(async (conn) => {
    if (!await repo.lockEvent(conn, eventId)) throw AppError.notFound('Không tìm thấy sự kiện.');
    if (!await repo.hasAssignment(conn, eventId, staffId)) {
      throw new AppError(403, resultMessages.STAFF_NOT_ASSIGNED, 'STAFF_NOT_ASSIGNED');
    }
    return repo.recentLogs(conn, eventId, staffId);
  });
}

export async function checkIn(eventId: number, staffId: number, rawCode: string): Promise<ScanResult> {
  const scanned = rawCode.trim();
  const isQr = scanned.startsWith('ticketbox:');
  const credential = isQr ? scanned.slice('ticketbox:'.length) : scanned;
  return repo.transaction(async (conn) => {
    // Event first serializes check-in with cancellation, then Order -> Ticket.
    const event = await repo.lockEvent(conn, eventId);
    if (!event) throw AppError.notFound('Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
    const assigned = await repo.hasAssignment(conn, eventId, staffId);
    let now = await repo.databaseNow(conn);
    const finish = async (code: ResultCode, ticket: repo.TicketRow | undefined = undefined): Promise<ScanResult> => {
      await repo.appendLog(conn, {
        eventId, staffId, ticketId: ticket?.id ?? null, code, hash: hashCode(scanned),
        // Never persist a reusable QR credential, including short malformed codes.
        masked: `***${hashCode(scanned).slice(0, 8)}`, message: resultMessages[code], now,
      });
      return {
        code, message: resultMessages[code], checkedAt: now,
        ticket: ticket && code !== 'WRONG_EVENT' ? {
          code: ticket.code, holderName: ticket.holderName,
          checkedInAt: code === 'SUCCESS' ? now : ticket.checkedInAt,
        } : null,
      };
    };
    // Denials are normal results, so their audit rows commit rather than roll back.
    if (!assigned) return finish('STAFF_NOT_ASSIGNED');
    const available = () => ['published', 'ongoing'].includes(event.status)
      && now >= event.checkinStartAt && now <= event.checkinEndAt;
    if (!available()) return finish('EVENT_NOT_AVAILABLE');
    if (isQr && !/^[a-f0-9]{64}$/.test(credential)) return finish('INVALID');
    const found = await repo.findTicket(conn, isQr ? hashCode(credential) : credential, isQr);
    if (!found) return finish('INVALID');
    if (found.eventId !== eventId) return finish('WRONG_EVENT', found);
    const orderStatus = await repo.lockOrder(conn, found.orderId);
    const ticket = await repo.lockTicket(conn, found.id);
    now = await repo.databaseNow(conn);
    if (!available()) return finish('EVENT_NOT_AVAILABLE');
    if (!ticket) return finish('INVALID');
    if (ticket.status === 'cancelled') return finish('CANCELLED', ticket);
    if (orderStatus !== 'confirmed') return finish('UNPAID', ticket);
    if (ticket.status === 'checked_in') return finish('ALREADY_CHECKED_IN', ticket);
    if (!await repo.markCheckedIn(conn, ticket.id, staffId, now)) {
      throw new AppError(409, 'Trạng thái vé vừa thay đổi. Hãy kiểm tra lại.', 'CHECKIN_CONFLICT');
    }
    return finish('SUCCESS', ticket);
  });
}
