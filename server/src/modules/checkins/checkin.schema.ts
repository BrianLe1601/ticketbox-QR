import { z } from 'zod';
export const eventParamsSchema = z.object({ eventId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER) });
export const scanSchema = z.object({ code: z.string().trim().min(1).max(512) }).strict();
