import { z } from 'zod';

export const orderStatusEnum = z.enum(['pending_payment', 'confirmed', 'expired', 'cancelled']);

export const listOrdersQuerySchema = z.object({
    status: orderStatusEnum.optional(),
    eventId: z.coerce.number().int().positive().optional(),
    buyerEmail: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});

export const orderIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const cancelOrderBodySchema = z.object({
    reason: z.string().trim().max(255).optional(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type AdminOrderIdParam = z.infer<typeof orderIdParamSchema>;
export type CancelOrderBody = z.infer<typeof cancelOrderBodySchema>;