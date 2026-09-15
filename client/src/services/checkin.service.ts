import { apiRequest } from './api';
export interface AssignedEvent {
  id: number; name: string; venue: string; status: string;
  startTime: string; checkinStartAt: string; checkinEndAt: string;
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
export const getRecentCheckins = (eventId: number, token: string | null, signal?: AbortSignal) =>
  apiRequest<CheckinLog[]>(`/staff/events/${eventId}/checkins`, { signal }, token);
export const submitCheckin = (eventId: number, code: string, token: string | null) =>
  apiRequest<CheckinResult>(`/staff/events/${eventId}/checkins`, {
    method: 'POST', body: JSON.stringify({ code }),
  }, token);
