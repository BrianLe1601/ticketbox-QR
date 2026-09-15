import type { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import * as service from './report.service.js';
import { reportWorkbook, logsWorkbook } from './report.export.js';
import type { LogQuery, ReportQuery } from './report.schema.js';
export async function events(req: Request, res: Response) { sendSuccess(res, await service.searchEvents(String(req.query.q))); }
export async function report(req: Request, res: Response) { sendSuccess(res, await service.getReport(req.query as unknown as ReportQuery)); }
export async function logs(req: Request, res: Response) {
  const result = await service.getLogs(req.query as unknown as LogQuery);
  sendPaginated(res, result.data, result.meta);
}
function sendFile(res: Response, filename: string, data: unknown) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(data as ArrayBuffer));
}
export async function exportReport(req: Request, res: Response) {
  const query = req.query as unknown as ReportQuery;
  sendFile(res, `ticketbox-report-${query.eventId}.xlsx`, await reportWorkbook(query, await service.getReport(query)));
}
export async function exportLogs(req: Request, res: Response) {
  const query = req.query as unknown as LogQuery;
  const result = await service.getLogs(query, true);
  sendFile(res, `ticketbox-checkins-${query.eventId}.xlsx`, await logsWorkbook(query, result.data));
}
