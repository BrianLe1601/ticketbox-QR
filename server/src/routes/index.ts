import { Router } from 'express';
import { eventsRouter } from '../modules/events/events.routes.js';

export const router = Router();

router.use('/events', eventsRouter);