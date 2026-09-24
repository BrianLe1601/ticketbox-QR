import { Router } from 'express';
import { validateCheckoutSession, getOrder, postOrder, postPayment, postEmailVerification, postEmailVerificationConfirm } from './checkout.controller.js';
import { validate } from '../../middlewares/validate.js';
import { createOrderBodySchema, orderIdParamSchema, orderLookupQuerySchema, payOrderBodySchema } from './checkout.schema.js';
import { requestEmailVerificationBodySchema, confirmEmailVerificationBodySchema } from './checkout.schema.js';

import { publicEmailErrorHandler } from '../tickets/ticket-retrieval.controller.js';

export const checkoutRouter = Router();

checkoutRouter.post(['/email-verifications', '/orders/verify-email/request'], validateCheckoutSession, validate(requestEmailVerificationBodySchema, 'body'), postEmailVerification);
checkoutRouter.post(['/email-verifications/confirm', '/orders/verify-email/confirm'], validateCheckoutSession, validate(confirmEmailVerificationBodySchema, 'body'), postEmailVerificationConfirm);

checkoutRouter.post('/orders', validate(createOrderBodySchema, 'body'), postOrder);
checkoutRouter.post('/orders/:id/pay', validate(orderIdParamSchema, 'params'), validate(payOrderBodySchema, 'body'), postPayment);
checkoutRouter.get(
    '/orders/:id',
    validate(orderIdParamSchema, 'params'),
    validate(orderLookupQuerySchema, 'query'),
    getOrder
);

checkoutRouter.use(publicEmailErrorHandler);
