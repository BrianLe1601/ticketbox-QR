import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { events, report, logs, exportReport, exportLogs } from './report.controller.js';
import { eventSearchSchema, reportQuerySchema, logQuerySchema } from './report.schema.js';
export const adminReportsRouter = Router();
export const adminCheckinsRouter = Router();
const exportLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.authUser!.id),
  message: { success: false, code: 'EXPORT_RATE_LIMIT', message: 'Vui lòng chờ một phút trước khi xuất thêm báo cáo.' },
});
for (const router of [adminReportsRouter, adminCheckinsRouter]) {
  router.use(authenticate, authorize('admin'));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
}
adminReportsRouter.get('/events', validate(eventSearchSchema, 'query'), events);
adminReportsRouter.get('/export', exportLimiter, validate(reportQuerySchema, 'query'), exportReport);
adminReportsRouter.get('/', validate(reportQuerySchema, 'query'), report);
adminCheckinsRouter.get('/export', exportLimiter, validate(logQuerySchema, 'query'), exportLogs);
adminCheckinsRouter.get('/', validate(logQuerySchema, 'query'), logs);
