import { z } from 'zod';
const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
// eventId is optional: omitting it means "all Events". Existing callers that send it keep working.
const period = {
  eventId: id.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};
// A snapshot id is opaque random text bound to the Admin who created it (see report.snapshot.ts).
export const snapshotIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/);
const page = z.coerce.number().int().min(1).max(1000000).default(1);
const validRange = (value: { from?: string | undefined; to?: string | undefined }) => !value.from || !value.to || value.from <= value.to;
export const reportQuerySchema = z.object({
  ...period,
  groupBy: z.enum(['day', 'month', 'year']).default('day'),
  // Per-Event breakdown pagination; served from the snapshot, not recomputed.
  page,
  limit: z.coerce.number().int().min(1).max(50).default(20),
  snapshotId: snapshotIdSchema.optional(),
}).strict().refine(validRange, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
export const logQuerySchema = z.object({
  ...period, staffId: id.optional(),
  result: z.enum(['SUCCESS', 'FAILED', 'ALREADY_CHECKED_IN', 'WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'EVENT_NOT_AVAILABLE', 'STAFF_NOT_ASSIGNED']).optional(),
  page,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  snapshotId: snapshotIdSchema.optional(),
}).strict().refine(validRange, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
export const eventSearchSchema = z.object({
  q: z.string().trim().max(100).default(''),
  page,
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type LogQuery = z.infer<typeof logQuerySchema>;
export type EventSearchQuery = z.infer<typeof eventSearchSchema>;
