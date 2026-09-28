// server/src/modules/orders/admin-orders.routes.ts
import { Router } from 'express';
import { getStats, getFilterOptions, getOrders, getOrderById, postCancelOrder, postResendEmail, postRetryEmail, patchEventRefunds, patchRefund } from './admin-orders.controller.js';
import { validate } from '../../middlewares/validate.js';
import { listOrdersQuerySchema, orderIdParamSchema, cancelOrderBodySchema, retryEmailParamSchema, refundTransitionBodySchema, eventRefundParamSchema, bulkRefundTransitionBodySchema } from './admin-orders.schema.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';

export const adminOrdersRouter = Router();

adminOrdersRouter.use(authenticate, authorize('admin'));

adminOrdersRouter.get('/', validate(listOrdersQuerySchema, 'query'), getOrders);
adminOrdersRouter.get('/stats', validate(listOrdersQuerySchema, 'query'), getStats);
adminOrdersRouter.get('/filter-options', getFilterOptions);
adminOrdersRouter.patch('/events/:eventId/refunds', validate(eventRefundParamSchema, 'params'), validate(bulkRefundTransitionBodySchema, 'body'), patchEventRefunds);
adminOrdersRouter.get('/:id', validate(orderIdParamSchema, 'params'), getOrderById);
adminOrdersRouter.post('/:id/cancel', validate(orderIdParamSchema, 'params'), validate(cancelOrderBodySchema, 'body'), postCancelOrder);
adminOrdersRouter.patch('/:id/refund', validate(orderIdParamSchema, 'params'), validate(refundTransitionBodySchema, 'body'), patchRefund);
adminOrdersRouter.post('/:id/resend-email', validate(orderIdParamSchema, 'params'), postResendEmail);
adminOrdersRouter.post('/:id/email-logs/:logId/retry', validate(retryEmailParamSchema, 'params'), postRetryEmail);
