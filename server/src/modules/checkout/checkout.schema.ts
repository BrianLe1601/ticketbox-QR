import { z } from 'zod';

export const orderItemInputSchema = z.object({
    ticketTypeId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive(),
});

export const createOrderBodySchema = z.object({
    eventId: z.coerce.number().int().positive(),
    items: z.array(orderItemInputSchema).min(1, 'Cần chọn ít nhất 1 vé'),
    buyer: z.object({
        name: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
        email: z.string().trim().toLowerCase().email('Email không hợp lệ')
            .refine((email) => email.endsWith('@gmail.com'), 'Vui lòng sử dụng địa chỉ Gmail'),
        phone: z.string().trim().max(20, 'Số điện thoại quá dài').optional(),
    }),
});

export const orderIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const orderLookupQuerySchema = z.object({
    token: z.string().min(1, 'Thiếu token tra cứu đơn hàng'),
});

export const payOrderBodySchema = z.object({
    token: z.string().min(1, 'Thiếu token thanh toán'),
});

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;
export type OrderLookupQuery = z.infer<typeof orderLookupQuerySchema>;
export type PayOrderBody = z.infer<typeof payOrderBodySchema>;
