import type { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import * as service from './report.service.js';
import { reportWorkbook, logsWorkbook } from './report.export.js';
import type { EventSearchQuery, LogQuery, ReportQuery } from './report.schema.js';

export async function events(req: Request, res: Response) {
  const result = await service.searchEvents(req.query as unknown as EventSearchQuery);
  sendPaginated(res, result.items, result.meta);
}
export async function report(req: Request, res: Response) {
  sendSuccess(res, await service.getReport(req.query as unknown as ReportQuery, req.authUser!.id));
}
export async function logs(req: Request, res: Response) {
  const result = await service.getLogs(req.query as unknown as LogQuery, req.authUser!.id);
  sendPaginated(res, result.data, result.meta);
}
function sendFile(res: Response, filename: string, data: unknown) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(data as ArrayBuffer));
}
export async function exportReport(req: Request, res: Response) {
  const data = await service.getReportForExport(req.query as unknown as ReportQuery, req.authUser!.id);
  sendFile(res, `ticketbox-report-${data.scope.eventId ?? 'all'}.xlsx`, await reportWorkbook(data));
}
export async function exportLogs(req: Request, res: Response) {
  const { data, rows } = await service.getLogsForExport(req.query as unknown as LogQuery, req.authUser!.id);
  sendFile(res, `ticketbox-checkins-${data.scope.eventId ?? 'all'}.xlsx`, await logsWorkbook(data, rows));
}
