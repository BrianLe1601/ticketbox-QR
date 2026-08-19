import { Router } from 'express';
import { getEvent, listEvents } from './events.controller.js';
import { validate } from '../../middlewares/validate.js';
import { eventIdParamSchema, listEventsQuerySchema } from './events.schema.js';

export const eventsRouter = Router();

// Route lấy danh sách sự kiện
eventsRouter.get('/', validate(listEventsQuerySchema, 'query'), listEvents);

// Route lấy chi tiết 1 sự kiện
eventsRouter.get('/:id', validate(eventIdParamSchema, 'params'), getEvent);