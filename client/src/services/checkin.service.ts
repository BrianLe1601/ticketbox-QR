import { apiRequest } from './api';
export interface AssignedEvent {
  id: number; name: string; venue: string; status: string;
  startTime: string; checkinStartAt: string; checkinEndAt: string;
}
export type AssignmentSegment = 'all' | 'open' | 'upcoming' | 'history';
export type AssignmentOperationalState = 'checkin_open' | 'upcoming' | 'preparing' | 'checkin_closed' | 'completed' | 'cancelled' | 'revoked';
export interface StaffAssignment {
  assignmentId: number;
  eventId: number;
  name: string;
  venue: string;
  address: string;
  city: string;
  startTime: string;
  endTime: string;
  status: string;
  checkinStartAt: string;
  checkinEndAt: string;
  assignedAt: string;
  revokedAt: string | null;
  isActive: boolean;
  operationalState: AssignmentOperationalState;
}
export interface StaffOverview {
  counts: { total: number; open: number; upcoming: number; history: number };
  openEvents: StaffAssignment[];
  nextUpcomingAssignment: StaffAssignment | null;
}
export interface CheckinResult {
  code: 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'WRONG_EVENT' | 'CANCELLED' | 'UNPAID'
    | 'INVALID' | 'EVENT_NOT_AVAILABLE' | 'STAFF_NOT_ASSIGNED';
  message: string; checkedAt: string;
  ticket: { code: string; holderName: string | null; checkedInAt: string | null } | null;
}
export interface CheckinLog {
  id: number; code: CheckinResult['code']; scannedCode: string; message: string; checkedAt: string;
}
export const getAssignedEvents = (token: string | null, signal?: AbortSignal) =>
  apiRequest<AssignedEvent[]>('/staff/events', { signal }, token);
export const getStaffOverview = (token: string | null, signal?: AbortSignal) =>
  apiRequest<StaffOverview>('/staff/overview', { signal }, token);
export const getStaffAssignments = (
  token: string | null,
  options: { segment?: AssignmentSegment; page?: number; limit?: number } = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams();
  if (options.segment) params.set('segment', options.segment);
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  const suffix = params.size ? `?${params.toString()}` : '';
  return apiRequest<StaffAssignment[]>(`/staff/assignments${suffix}`, { signal }, token);
};
export const getStaffAssignment = (assignmentId: number, token: string | null, signal?: AbortSignal) =>
  apiRequest<StaffAssignment>(`/staff/assignments/${assignmentId}`, { signal }, token);
export const getAssignmentCheckins = (
  assignmentId: number,
  token: string | null,
  options: { page?: number; limit?: number; result?: CheckinLog['code'] } = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams();
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.result) params.set('result', options.result);
  const suffix = params.size ? `?${params.toString()}` : '';
  return apiRequest<CheckinLog[]>(`/staff/assignments/${assignmentId}/checkins${suffix}`, { signal }, token);
};
export const getRecentCheckins = (eventId: number, token: string | null, signal?: AbortSignal) =>
  apiRequest<CheckinLog[]>(`/staff/events/${eventId}/checkins`, { signal }, token);
export const submitCheckin = (eventId: number, code: string, token: string | null) =>
  apiRequest<CheckinResult>(`/staff/events/${eventId}/checkins`, {
    method: 'POST', body: JSON.stringify({ code }),
  }, token);
