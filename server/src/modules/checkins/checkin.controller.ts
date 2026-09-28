import type { Request, Response } from 'express';
import { sendPaginated, sendSuccess } from '../../utils/response.js';
import * as service from './checkin.service.js';
import type { AssignmentListQuery, AssignmentLogsQuery } from './checkin.schema.js';

export async function listEvents(req: Request, res: Response) {
  sendSuccess(res, await service.getAssignedEvents(req.authUser!.id));
}
export async function scan(req: Request, res: Response) {
  sendSuccess(res, await service.checkIn(Number(req.params.eventId), req.authUser!.id, req.body.code));
}
export async function listLogs(req: Request, res: Response) {
  sendSuccess(res, await service.getRecentLogs(Number(req.params.eventId), req.authUser!.id));
}
export async function overview(req: Request, res: Response) {
  sendSuccess(res, await service.getOverview(req.authUser!.id));
}
export async function listAssignments(req: Request, res: Response) {
  const result = await service.getAssignments(req.authUser!.id, req.query as unknown as AssignmentListQuery);
  sendPaginated(res, result.data, result.meta);
}
export async function assignment(req: Request, res: Response) {
  sendSuccess(res, await service.getAssignment(req.authUser!.id, Number(req.params.assignmentId)));
}
export async function assignmentLogs(req: Request, res: Response) {
  const result = await service.getAssignmentLogs(req.authUser!.id, Number(req.params.assignmentId), req.query as unknown as AssignmentLogsQuery);
  sendPaginated(res, result.data, result.meta);
}
