// server/src/modules/orders/admin-orders.routes.ts
import { Router } from 'express';
import { getOrders, getOrderById, postCancelOrder, postResendEmail } from './admin-orders.controller.js';
import { validate } from '../../middlewares/validate.js';
import { listOrdersQuerySchema, orderIdParamSchema, cancelOrderBodySchema } from './admin-orders.schema.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';

export const adminOrdersRouter = Router();

adminOrdersRouter.use(authenticate, authorize('admin'));

adminOrdersRouter.get('/', validate(listOrdersQuerySchema, 'query'), getOrders);
adminOrdersRouter.get('/:id', validate(orderIdParamSchema, 'params'), getOrderById);
adminOrdersRouter.post('/:id/cancel', validate(orderIdParamSchema, 'params'), validate(cancelOrderBodySchema, 'body'), postCancelOrder);
adminOrdersRouter.post('/:id/resend-email', validate(orderIdParamSchema, 'params'), postResendEmail);