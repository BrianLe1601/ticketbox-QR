import type { NextFunction, Request, Response } from 'express';
import { getEventDetail, getEventList } from './events.service.js';
import { sendPaginated, sendSuccess } from '../../utils/response.js';
import type { ListEventsQuery } from './events.schema.js';

export async function listEvents(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query as unknown as ListEventsQuery;
        const { items, meta } = await getEventList(query);
        sendPaginated(res, items, meta);
    } catch (err) {
        next(err);
    }
}

export async function getEvent(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as { id: number };
        const event = await getEventDetail(id);
        sendSuccess(res, event);
    } catch (err) {
        next(err);
    }
}