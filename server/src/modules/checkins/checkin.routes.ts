import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { eventParamsSchema, scanSchema } from './checkin.schema.js';
import { listEvents, listLogs, scan } from './checkin.controller.js';

export const checkinRouter = Router();
checkinRouter.use(authenticate, authorize('staff'));
const scanLimiter = rateLimit({
  windowMs: 60_000, limit: 180, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.authUser!.id),
  message: { success: false, code: 'SCAN_RATE_LIMIT', message: 'Quét quá nhanh. Vui lòng chờ một phút rồi thử lại.' },
});
checkinRouter.get('/events', listEvents);
checkinRouter.get('/events/:eventId/checkins', validate(eventParamsSchema, 'params'), listLogs);
checkinRouter.post('/events/:eventId/checkins', scanLimiter, validate(eventParamsSchema, 'params'), validate(scanSchema), scan);
