import { z } from 'zod';
const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const period = {
  eventId: id,
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};
const validRange = (value: { from?: string | undefined; to?: string | undefined }) => !value.from || !value.to || value.from <= value.to;
export const reportQuerySchema = z.object(period).strict().refine(validRange, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
export const logQuerySchema = z.object({
  ...period, staffId: id.optional(),
  result: z.enum(['SUCCESS', 'ALREADY_CHECKED_IN', 'WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'EVENT_NOT_AVAILABLE', 'STAFF_NOT_ASSIGNED']).optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(validRange, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
export const eventSearchSchema = z.object({ q: z.string().trim().max(100).default('') }).strict();
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type LogQuery = z.infer<typeof logQuerySchema>;
