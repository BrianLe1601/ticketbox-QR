import { Router } from 'express';
import { getOrder, postOrder, postPayment } from './checkout.controller.js';
import { validate } from '../../middlewares/validate.js';
import { createOrderBodySchema, orderIdParamSchema, orderLookupQuerySchema, payOrderBodySchema } from './checkout.schema.js';

export const checkoutRouter = Router();

checkoutRouter.post('/orders', validate(createOrderBodySchema, 'body'), postOrder);
checkoutRouter.post('/orders/:id/pay', validate(orderIdParamSchema, 'params'), validate(payOrderBodySchema, 'body'), postPayment);
checkoutRouter.get(
    '/orders/:id',
    validate(orderIdParamSchema, 'params'),
    validate(orderLookupQuerySchema, 'query'),
    getOrder
);
