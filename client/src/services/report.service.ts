import { apiRequest, apiDownload } from './api';
export interface ReportEvent { id: number; name: string; status: string }
export interface EventReport extends ReportEvent {
  confirmedOrders: number; soldTickets: number; issuedTickets: number; admissions: number;
  scans: number; rejectedScans: number; capacity: number; fillRate: number; attendanceRate: number;
  grossRevenue: number; refundedAmount: number; netRevenue: number;
  revenueSeries: Array<{ period: string; grossRevenue: number; refundedAmount: number; netRevenue: number }>;
}
export interface AdminCheckinLog {
  id: number; eventName: string; staffId: number; staffName: string; ticketCode: string | null;
  ticketStatus: string | null; ticketTypeName: string | null;
  holderName: string | null; holderEmail: string | null; orderCode: string | null;
  buyerName: string | null; buyerEmail: string | null; buyerPhone: string | null;
  result: string; scannedCode: string | null; message: string | null; checkedAt: string;
}
export interface CheckinLogStats { total: number; success: number; rejected: number; duplicate: number; invalid: number }
export interface CheckinLogMeta { total: number; page: number; limit: number; stats: CheckinLogStats }
export interface OperationFilters { eventId: string; from: string; to: string; staffId?: string; result?: string; groupBy?: 'day' | 'month' | 'year' }
function queryString(filters: OperationFilters, page?: number, includeGroupBy = true) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && (includeGroupBy || key !== 'groupBy')) query.set(key, value);
  }
  if (page !== undefined) { query.set('page', String(page)); query.set('limit', '20'); }
  return query.toString();
}
export const searchReportEvents = (q: string, token: string | null, signal: AbortSignal) =>
  apiRequest<ReportEvent[]>(`/admin/reports/events?q=${encodeURIComponent(q)}`, { signal }, token);
export const loadReport = (filters: OperationFilters, token: string | null, signal: AbortSignal) =>
  apiRequest<EventReport>(`/admin/reports?${queryString(filters)}`, { signal }, token);
export const loadAdminLogs = (filters: OperationFilters, page: number, token: string | null, signal: AbortSignal) =>
  apiRequest<AdminCheckinLog[], CheckinLogMeta>(`/admin/checkins?${queryString(filters, page, false)}`, { signal }, token);
export const exportOperations = (kind: 'reports' | 'checkins', filters: OperationFilters, token: string | null) =>
  apiDownload(`/admin/${kind}/export?${queryString(filters, undefined, kind === 'reports')}`, token);
