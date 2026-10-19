import { apiRequest, apiDownload } from './api';

export interface ReportEvent { id: number; name: string; status: string; startTime?: string }
export interface PageMeta { total: number; page: number; limit: number }
export interface RateBasis { numerator: number; denominator: number; percent: number }
export interface BreakdownRow {
  id: number; name: string; status: string; confirmedOrders: number; soldTickets: number; issuedTickets: number;
  admissions: number; scans: number; rejectedScans: number; capacity: number; grossRevenue: number;
  refundedAmount: number; netRevenue: number; fillRate: number; attendanceRate: number;
  /** Event start (the server already sends it with each row). */
  startTime?: string;
}
/** Short-lived server snapshot: the view and its Excel file are rendered from the same one. */
export interface SnapshotInfo { id: string; generatedAt: string; expiresAt: string }
export interface EventReport {
  /** Single-Event fields kept from the original contract; `id` is null for "all Events". */
  id: number | null; name: string; status: string;
  confirmedOrders: number; soldTickets: number; issuedTickets: number; admissions: number;
  scans: number; rejectedScans: number; capacity: number; fillRate: number; attendanceRate: number;
  grossRevenue: number; refundedAmount: number; netRevenue: number;
  revenueSeries: Array<{ period: string; grossRevenue: number; refundedAmount: number; netRevenue: number }>;
  scope: { type: 'all' | 'event'; eventId: number | null; eventName: string | null; eventCount: number };
  rates: { fillRate: RateBasis; attendanceRate: RateBasis };
  breakdown: { items: BreakdownRow[]; meta: PageMeta };
  snapshot: SnapshotInfo;
}
export interface AdminCheckinLog {
  id: number; eventId: number; eventName: string; staffId: number; staffName: string; ticketCode: string | null;
  ticketStatus: string | null; ticketTypeName: string | null;
  holderName: string | null; holderEmail: string | null; orderCode: string | null;
  buyerName: string | null; buyerEmail: string | null; buyerPhone: string | null;
  result: string; scannedCode: string | null; message: string | null; checkedAt: string;
}
export interface CheckinLogStats { total: number; success: number; rejected: number; duplicate: number; invalid: number }
export interface CheckinLogMeta extends PageMeta {
  stats: CheckinLogStats;
  scope: { type: 'all' | 'event'; eventId: number | null; eventName: string | null };
  snapshot: SnapshotInfo;
}
/** An empty eventId means "all Events". */
export interface OperationFilters { eventId: string; from: string; to: string; staffId?: string; result?: string; groupBy?: 'day' | 'month' | 'year' }

export const PAGE_SIZE = 20;

function queryString(filters: OperationFilters, options: { report: boolean; page?: number; snapshotId?: string | null }) {
  const query = new URLSearchParams();
  // Reports and check-in history share a screen but not a filter contract.
  // Never leak a retained Staff/result filter into the strict report API.
  const keys: Array<keyof OperationFilters> = options.report
    ? ['eventId', 'from', 'to', 'groupBy']
    : ['eventId', 'from', 'to', 'staffId', 'result'];
  for (const key of keys) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  if (options.page !== undefined) { query.set('page', String(options.page)); query.set('limit', String(PAGE_SIZE)); }
  if (options.snapshotId) query.set('snapshotId', options.snapshotId);
  return query.toString();
}
export const searchReportEvents = (q: string, page: number, token: string | null, signal: AbortSignal) =>
  apiRequest<ReportEvent[], PageMeta>(`/admin/reports/events?q=${encodeURIComponent(q)}&page=${page}&limit=${PAGE_SIZE}`, { signal }, token);
export const loadReport = (filters: OperationFilters, page: number, snapshotId: string | null, token: string | null, signal: AbortSignal) =>
  apiRequest<EventReport>(`/admin/reports?${queryString(filters, { report: true, page, snapshotId })}`, { signal }, token);
export const loadAdminLogs = (filters: OperationFilters, page: number, snapshotId: string | null, token: string | null, signal: AbortSignal) =>
  apiRequest<AdminCheckinLog[], CheckinLogMeta>(`/admin/checkins?${queryString(filters, { report: false, page, snapshotId })}`, { signal }, token);
/** The file is rendered from the snapshot the Admin is viewing, so it matches the screen exactly. */
export const exportOperations = (kind: 'reports' | 'checkins', filters: OperationFilters, snapshotId: string | null, token: string | null) =>
  apiDownload(`/admin/${kind}/export?${queryString(filters, { report: kind === 'reports', snapshotId })}`, token);
