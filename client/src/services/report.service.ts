import { apiRequest, apiDownload } from './api';
export interface ReportEvent { id: number; name: string; status: string }
export interface EventReport extends ReportEvent {
  confirmedOrders: number; soldTickets: number; issuedTickets: number; admissions: number;
  scans: number; rejectedScans: number; grossRevenue: number; refundedAmount: number; netRevenue: number;
}
export interface AdminCheckinLog {
  id: number; eventName: string; staffId: number; staffName: string; ticketCode: string | null;
  result: string; scannedCode: string | null; message: string | null; checkedAt: string;
}
export interface OperationFilters { eventId: string; from: string; to: string; staffId?: string; result?: string }
function queryString(filters: OperationFilters, page?: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (page !== undefined) { query.set('page', String(page)); query.set('limit', '20'); }
  return query.toString();
}
export const searchReportEvents = (q: string, token: string | null, signal: AbortSignal) =>
  apiRequest<ReportEvent[]>(`/admin/reports/events?q=${encodeURIComponent(q)}`, { signal }, token);
export const loadReport = (filters: OperationFilters, token: string | null, signal: AbortSignal) =>
  apiRequest<EventReport>(`/admin/reports?${queryString(filters)}`, { signal }, token);
export const loadAdminLogs = (filters: OperationFilters, page: number, token: string | null, signal: AbortSignal) =>
  apiRequest<AdminCheckinLog[]>(`/admin/checkins?${queryString(filters, page)}`, { signal }, token);
export const exportOperations = (kind: 'reports' | 'checkins', filters: OperationFilters, token: string | null) =>
  apiDownload(`/admin/${kind}/export?${queryString(filters)}`, token);
