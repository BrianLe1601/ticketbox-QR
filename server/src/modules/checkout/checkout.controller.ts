import type { NextFunction, Request, Response } from 'express';
import { createOrder, getOrderByLookupToken, payOrder } from './checkout.service.js';
import { sendSuccess } from '../../utils/response.js';
import type { CreateOrderBody, OrderIdParam, OrderLookupQuery, PayOrderBody } from './checkout.schema.js';

export async function postOrder(req: Request, res: Response, next: NextFunction) {
    try {
        const body = req.body as CreateOrderBody;
        const order = await createOrder(body);
        sendSuccess(res, order, 201);
    } catch (err) {
        next(err);
    }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as OrderIdParam;
        const { token } = req.query as unknown as OrderLookupQuery;
        const order = await getOrderByLookupToken(id, token);
        sendSuccess(res, order);
    } catch (err) {
        next(err);
    }
}

export async function postPayment(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as OrderIdParam;
        const { token } = req.body as PayOrderBody;
        sendSuccess(res, await payOrder(id, token));
    } catch (err) {
        next(err);
    }
}
