import type { RequestHandler, ErrorRequestHandler } from 'express';
import { retrieveTickets } from './ticket-retrieval.service.js';
import { EmailRateLimitError } from '../../services/public-email-security.service.js';
import { sendSuccess } from '../../utils/response.js';

export const postTicketRetrieval: RequestHandler = async (req, res, next) => {
    try { sendSuccess(res, await retrieveTickets(req.body.email, req.body.recaptchaToken, req.ip ?? req.socket.remoteAddress ?? 'unknown')); }
    catch (error) { next(error); }
};
export const publicEmailErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (!(error instanceof EmailRateLimitError)) return next(error);
    res.setHeader('Retry-After', error.retryAfterSeconds);
    res.status(429).json({ success: false, message: error.message, code: error.code, retryAfterSeconds: error.retryAfterSeconds });
};
