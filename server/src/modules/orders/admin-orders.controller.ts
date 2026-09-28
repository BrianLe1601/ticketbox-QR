import type { NextFunction, Request, Response } from 'express';
import { getOrderStats, getOrderFilterOptions, listOrders, getOrderDetail, cancelOrder, resendTicketEmail, retryOrderEmail, updateEventRefunds, updateRefundStatus } from './admin-orders.service.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import type { ListOrdersQuery, AdminOrderIdParam, BulkRefundTransitionBody, EventRefundParam, RetryEmailParam, RefundTransitionBody } from './admin-orders.schema.js';

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
        sendSuccess(res, await cancelOrder(id));
    } catch (err) { next(err); }
}

export async function postResendEmail(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as AdminOrderIdParam;
        sendSuccess(res, await resendTicketEmail(id), 202);
    } catch (err) { next(err); }
}
export async function getStats(req: Request, res: Response, next: NextFunction) {
    try {
        const query = req.query as unknown as ListOrdersQuery;
        sendSuccess(res, await getOrderStats(query.eventId));
    } catch (error) { next(error); }
}

export async function getFilterOptions(_req: Request, res: Response, next: NextFunction) {
    try { sendSuccess(res, await getOrderFilterOptions()); } catch (error) { next(error); }
}

export async function patchRefund(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params as unknown as AdminOrderIdParam;
        sendSuccess(res, await updateRefundStatus(id, req.body as RefundTransitionBody));
    } catch (error) { next(error); }
}

export async function patchEventRefunds(req: Request, res: Response, next: NextFunction) {
    try {
        const { eventId } = req.params as unknown as EventRefundParam;
        sendSuccess(res, await updateEventRefunds(eventId, req.body as BulkRefundTransitionBody));
    } catch (error) { next(error); }
}

export async function postRetryEmail(req: Request, res: Response, next: NextFunction) {
    try {
        const { id, logId } = req.params as unknown as RetryEmailParam;
        sendSuccess(res, await retryOrderEmail(id, logId), 202);
    } catch (error) { next(error); }
}
