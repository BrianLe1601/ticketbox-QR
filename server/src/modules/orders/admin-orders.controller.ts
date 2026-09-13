import type { NextFunction, Request, Response } from 'express';
import { listOrders, getOrderDetail, cancelOrder, resendTicketEmail } from './admin-orders.service.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import type { ListOrdersQuery, AdminOrderIdParam, CancelOrderBody } from './admin-orders.schema.js';

export async function getOrders(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query as unknown as ListOrdersQuery;
        const result = await listOrders(query);
        sendPaginated(res, result.items, result.meta);
    } catch (err) { next(err); }
}

export async function getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as AdminOrderIdParam;
        sendSuccess(res, await getOrderDetail(id));
    } catch (err) { next(err); }
}

export async function postCancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as AdminOrderIdParam;
        const body = req.body as CancelOrderBody;
        const adminId = req.authUser!.id; // xem ghi chú bên dưới về req.user
        sendSuccess(res, await cancelOrder(id, adminId, body));
    } catch (err) { next(err); }
}

export async function postResendEmail(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as AdminOrderIdParam;
        sendSuccess(res, await resendTicketEmail(id));
    } catch (err) { next(err); }
}