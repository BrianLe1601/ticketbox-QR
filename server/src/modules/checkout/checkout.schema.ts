import { z } from 'zod';

export const orderItemInputSchema = z.object({
    ticketTypeId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive(),
});

export const createOrderBodySchema = z.object({
    eventId: z.coerce.number().int().positive(),
    emailVerificationToken: z.string().min(1, 'Gmail chưa được xác minh'),
    items: z.array(orderItemInputSchema).min(1, 'Cần chọn ít nhất 1 vé'),
    buyer: z.object({
        name: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
        email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
        phone: z.string().trim().max(20, 'Số điện thoại quá dài').optional(),
    }),
}).superRefine((body, ctx) => {
    const seen = new Set<number>();
    body.items.forEach((item, index) => {
        if (seen.has(item.ticketTypeId)) {
            ctx.addIssue({
                code: 'custom',
                path: ['items', index, 'ticketTypeId'],
                message: 'Mỗi loại vé chỉ được xuất hiện một lần',
            });
        }
        seen.add(item.ticketTypeId);
    });
});

export const idempotencyKeySchema = z.string()
    .min(16, 'Idempotency-Key phải có ít nhất 16 ký tự')
    .max(100, 'Idempotency-Key không được quá 100 ký tự')
    .regex(/^[A-Za-z0-9._:-]+$/, 'Idempotency-Key chứa ký tự không hợp lệ');

export const orderIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const orderLookupQuerySchema = z.object({
    token: z.string().min(1, 'Thiếu token tra cứu đơn hàng'),
});

const gmailSchema = z.string().trim().toLowerCase().email('Email không hợp lệ');
export const requestEmailVerificationBodySchema = z.object({ email: gmailSchema, recaptchaToken: z.string().min(1).max(4096) });
export const confirmEmailVerificationBodySchema = z.object({ email: gmailSchema, otp: z.string().regex(/^\d{6}$/, 'Mã xác minh gồm 6 chữ số') });

export const payOrderBodySchema = z.object({
    token: z.string().min(1, 'Thiếu token thanh toán'),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type OrderLookupQuery = z.infer<typeof orderLookupQuerySchema>;
export type PayOrderBody = z.infer<typeof payOrderBodySchema>;
export type RequestEmailVerificationBody = z.infer<typeof requestEmailVerificationBodySchema>;
export type ConfirmEmailVerificationBody = z.infer<typeof confirmEmailVerificationBodySchema>;
