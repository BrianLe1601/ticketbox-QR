import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response.js';
import * as service from './checkin.service.js';

export async function listEvents(req: Request, res: Response) {
  sendSuccess(res, await service.getAssignedEvents(req.authUser!.id));
}
export async function scan(req: Request, res: Response) {
  sendSuccess(res, await service.checkIn(Number(req.params.eventId), req.authUser!.id, req.body.code));
}
export async function listLogs(req: Request, res: Response) {
  sendSuccess(res, await service.getRecentLogs(Number(req.params.eventId), req.authUser!.id));
}
