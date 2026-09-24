import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middlewares/validate.js';
import { postTicketRetrieval, publicEmailErrorHandler } from './ticket-retrieval.controller.js';

export const ticketsRouter = Router();
ticketsRouter.post('/retrieval', validate(z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    recaptchaToken: z.string().min(1).max(4096),
})), postTicketRetrieval);
ticketsRouter.use(publicEmailErrorHandler);
