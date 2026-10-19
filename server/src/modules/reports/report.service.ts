import { AppError } from '../../utils/app-error.js';
import { rateBasis, sumCounts, type EventMetrics, type RateBasisSet } from './report.metrics.js';
import * as repo from './report.repository.js';
import type { LogScope, LogStats, RevenuePoint, ReportEventRow } from './report.repository.js';
import type { EventSearchQuery, LogQuery, ReportQuery } from './report.schema.js';
import { loadSnapshot, saveSnapshot, type SnapshotInfo } from './report.snapshot.js';

export const EXPORT_ROW_LIMIT = 10000;
export const ALL_EVENTS_LABEL = 'Tất cả sự kiện';

export interface Scope { type: 'all' | 'event'; eventId: number | null; eventName: string | null; eventStatus: string | null }

export async function searchEvents(query: EventSearchQuery) {
  const { rows, total } = await repo.searchEvents(query);
  return { items: rows, meta: { total, page: query.page, limit: query.limit } };
}

async function resolveScope(conn: Parameters<typeof repo.findEvent>[0], eventId: number | undefined): Promise<Scope> {
  if (!eventId) return { type: 'all', eventId: null, eventName: null, eventStatus: null };
  const event = await repo.findEvent(conn, eventId);
  if (!event) throw AppError.notFound('Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
  return { type: 'event', eventId: Number(event.id), eventName: String(event.name), eventStatus: String(event.status) };
}

// ---------------------------------------------------------------- Reports

export interface ReportFilters { eventId: number | null; from: string | null; to: string | null; groupBy: 'day' | 'month' | 'year' }
/** Everything a report view and its Excel file show, captured once. */
export interface ReportData {
  scope: Scope; filters: ReportFilters; generatedAt: string;
  totals: EventMetrics; rates: RateBasisSet; events: ReportEventRow[]; revenueSeries: RevenuePoint[];
}

const normalizeReportFilters = (query: Pick<ReportQuery, 'eventId' | 'from' | 'to' | 'groupBy'>): ReportFilters =>
  ({ eventId: query.eventId ?? null, from: query.from ?? null, to: query.to ?? null, groupBy: query.groupBy });

async function computeReport(query: ReportQuery): Promise<ReportData> {
  return repo.readSnapshot(async (conn) => {
    const scope = await resolveScope(conn, query.eventId);
    const events = await repo.reportRows(conn, query);
    if (events.length > repo.MAX_REPORT_EVENTS) {
      throw AppError.badRequest(`Phạm vi có hơn ${repo.MAX_REPORT_EVENTS} sự kiện. Hãy chọn một sự kiện cụ thể.`, 'REPORT_SCOPE_TOO_LARGE');
    }
    // Totals come from summed numerators/denominators, never from averaging the per-Event percentages.
    const totals = sumCounts(events);
    return {
      scope, filters: normalizeReportFilters(query), generatedAt: new Date().toISOString(),
      totals, rates: rateBasis(totals), events, revenueSeries: await repo.revenueSeries(conn, query),
    };
  });
}

function assertSameFilters(snapshot: object, current: object) {
  if (JSON.stringify(snapshot) !== JSON.stringify(current)) {
    throw new AppError(409, 'Bộ lọc đã thay đổi so với dữ liệu đang xem. Hãy áp dụng lại bộ lọc trước khi tiếp tục.', 'SNAPSHOT_FILTER_MISMATCH');
  }
}

function reportPayload(data: ReportData, info: SnapshotInfo, page: number, limit: number) {
  const { scope, totals } = data;
  const start = (page - 1) * limit;
  return {
    // Flat fields keep the original single-Event response shape for existing clients.
    id: scope.eventId, name: scope.eventName ?? ALL_EVENTS_LABEL, status: scope.eventStatus ?? 'all',
    ...totals, revenueSeries: data.revenueSeries,
    scope: { type: scope.type, eventId: scope.eventId, eventName: scope.eventName, eventCount: data.events.length },
    filters: data.filters, rates: data.rates,
    breakdown: { items: data.events.slice(start, start + limit), meta: { total: data.events.length, page, limit } },
    snapshot: info,
  };
}

/** View a report. The first call captures a snapshot; later pages and the export reuse it. */
export async function getReport(query: ReportQuery, adminId: number) {
  if (query.snapshotId) {
    const { data, info } = loadSnapshot<ReportData>(adminId, 'report', query.snapshotId);
    assertSameFilters(data.filters, normalizeReportFilters(query));
    return reportPayload(data, info, query.page, query.limit);
  }
  const data = await computeReport(query);
  return reportPayload(data, saveSnapshot(adminId, 'report', data, Date.parse(data.generatedAt)), query.page, query.limit);
}

/** The export always renders the snapshot the Admin is looking at; without one it captures a fresh one. */
export async function getReportForExport(query: ReportQuery, adminId: number): Promise<ReportData> {
  if (query.snapshotId) {
    const { data } = loadSnapshot<ReportData>(adminId, 'report', query.snapshotId);
    assertSameFilters(data.filters, normalizeReportFilters(query));
    return data;
  }
  return computeReport(query);
}

// ---------------------------------------------------------------- Check-in logs

export interface LogFilters {
  eventId: number | null; from: string | null; to: string | null; staffId: number | null; result: string | null;
}
/** Logs are append-only, so (filters + highest log id) reproduces the exact rows later. */
export interface LogSnapshotData {
  scope: Scope; filters: LogFilters; watermark: number; total: number; stats: LogStats; generatedAt: string;
}

const normalizeLogFilters = (query: Pick<LogQuery, 'eventId' | 'from' | 'to' | 'staffId' | 'result'>): LogFilters => ({
  eventId: query.eventId ?? null, from: query.from ?? null, to: query.to ?? null,
  staffId: query.staffId ?? null, result: query.result ?? null,
});
const toScope = (filters: LogFilters): LogScope => ({
  eventId: filters.eventId ?? undefined, from: filters.from ?? undefined, to: filters.to ?? undefined,
  staffId: filters.staffId ?? undefined, result: filters.result ?? undefined,
});

async function captureLogs(query: LogQuery): Promise<LogSnapshotData> {
  return repo.readSnapshot(async (conn) => {
    const filters = normalizeLogFilters(query);
    const scope = await resolveScope(conn, query.eventId);
    const watermark = await repo.maxLogId(conn);
    const [total, stats] = await Promise.all([
      repo.countLogs(conn, toScope(filters), watermark), repo.logStats(conn, toScope(filters), watermark),
    ]);
    return { scope, filters, watermark, total, stats, generatedAt: new Date().toISOString() };
  });
}

function logsPayload(data: LogSnapshotData, rows: repo.LogRow[], info: SnapshotInfo, page: number, limit: number) {
  return {
    data: rows,
    meta: {
      total: data.total, page, limit, stats: data.stats,
      scope: { type: data.scope.type, eventId: data.scope.eventId, eventName: data.scope.eventName },
      filters: data.filters, snapshot: info,
    },
  };
}

export async function getLogs(query: LogQuery, adminId: number) {
  let data: LogSnapshotData; let info: SnapshotInfo;
  if (query.snapshotId) {
    ({ data, info } = loadSnapshot<LogSnapshotData>(adminId, 'logs', query.snapshotId));
    assertSameFilters(data.filters, normalizeLogFilters(query));
  } else {
    data = await captureLogs(query);
    info = saveSnapshot(adminId, 'logs', data, Date.parse(data.generatedAt));
  }
  const rows = await repo.readSnapshot((conn) => repo.logs(conn, toScope(data.filters), data.watermark, query.limit, (query.page - 1) * query.limit));
  return logsPayload(data, rows, info, query.page, query.limit);
}

/** Every row matching the viewed snapshot (not only the current page), refusing oversized exports. */
export async function getLogsForExport(query: LogQuery, adminId: number) {
  const data = query.snapshotId
    ? loadSnapshot<LogSnapshotData>(adminId, 'logs', query.snapshotId).data
    : await captureLogs(query);
  if (query.snapshotId) assertSameFilters(data.filters, normalizeLogFilters(query));
  if (data.total > EXPORT_ROW_LIMIT) {
    throw AppError.badRequest('Tối đa 10.000 dòng mỗi file. Hãy thu hẹp bộ lọc ngày, sự kiện hoặc kết quả.', 'EXPORT_TOO_LARGE');
  }
  const rows = await repo.readSnapshot((conn) => repo.logs(conn, toScope(data.filters), data.watermark, EXPORT_ROW_LIMIT, 0));
  return { data, rows };
}
