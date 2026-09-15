import { AppError } from '../../utils/app-error.js';
import * as repo from './report.repository.js';
import type { LogQuery, ReportQuery } from './report.schema.js';
export const searchEvents = repo.searchEvents;
export async function getReport(query: ReportQuery) {
  return repo.readSnapshot(async (conn) => {
    const result = await repo.report(conn, query);
    if (!result) throw AppError.notFound('Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
    return result;
  });
}
export async function getLogs(query: LogQuery, exporting = false) {
  return repo.readSnapshot(async (conn) => {
    if (!await repo.findEvent(conn, query.eventId)) throw AppError.notFound('Không tìm thấy sự kiện.', 'EVENT_NOT_FOUND');
    const total = await repo.countLogs(conn, query);
    if (exporting && total > 10000) throw AppError.badRequest('Tối đa 10.000 dòng mỗi file. Hãy thu hẹp bộ lọc ngày hoặc kết quả.', 'EXPORT_TOO_LARGE');
    const data = await repo.logs(conn, query, exporting ? 10000 : query.limit, exporting ? 0 : (query.page - 1) * query.limit);
    return { data, meta: { total, page: exporting ? 1 : query.page, limit: exporting ? 10000 : query.limit } };
  });
}
