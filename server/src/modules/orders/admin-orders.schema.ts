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

export const eventRefundParamSchema = z.object({
    eventId: z.coerce.number().int().positive(),
});

export const retryEmailParamSchema = z.object({ id: z.coerce.number().int().positive(), logId: z.coerce.number().int().positive() });
export type RetryEmailParam = z.infer<typeof retryEmailParamSchema>;

export const refundTransitionBodySchema = z.object({
    status: z.enum(['processing', 'completed', 'failed']),
    failureReason: z.string().trim().min(5).max(500).optional(),
}).superRefine((body, ctx) => {
    if (body.status === 'failed' && !body.failureReason) {
        ctx.addIssue({ code: 'custom', path: ['failureReason'], message: 'Cần nhập lý do khi đánh dấu hoàn tiền mô phỏng thất bại' });
    }
    if (body.status !== 'failed' && body.failureReason) {
        ctx.addIssue({ code: 'custom', path: ['failureReason'], message: 'Chỉ nhập lý do cho trạng thái thất bại' });
    }
});

export const bulkRefundTransitionBodySchema = z.object({
    status: z.enum(['processing', 'completed']),
}).strict();

export const cancelOrderBodySchema = z.object({}).strict();

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type AdminOrderIdParam = z.infer<typeof orderIdParamSchema>;
export type RefundTransitionBody = z.infer<typeof refundTransitionBodySchema>;
export type EventRefundParam = z.infer<typeof eventRefundParamSchema>;
export type BulkRefundTransitionBody = z.infer<typeof bulkRefundTransitionBodySchema>;
