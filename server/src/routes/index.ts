import { Router } from 'express';
import { eventsRouter } from '../modules/events/events.routes.js';
import { checkoutRouter } from '../modules/checkout/checkout.routes.js';

export const router = Router();

router.use('/events', eventsRouter);
router.use('/checkout', checkoutRouter);