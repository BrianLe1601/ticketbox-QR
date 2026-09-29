import { Router } from 'express';
import { getEvent, listEvents, getEventStats } from './events.controller.js';
import { validate } from '../../middlewares/validate.js';
import { eventIdParamSchema, listEventsQuerySchema, publicStatsQuerySchema } from './events.schema.js';

export const eventsRouter = Router();

eventsRouter.get('/stats', validate(publicStatsQuerySchema, 'query'), getEventStats);

// Route lấy danh sách sự kiện
eventsRouter.get('/', validate(listEventsQuerySchema, 'query'), listEvents);

// Route lấy chi tiết 1 sự kiện
eventsRouter.get('/:id', validate(eventIdParamSchema, 'params'), getEvent);
