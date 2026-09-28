import { z } from 'zod';
const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const checkinResult = z.enum(['SUCCESS', 'ALREADY_CHECKED_IN', 'WRONG_EVENT', 'CANCELLED', 'UNPAID', 'INVALID', 'EVENT_NOT_AVAILABLE', 'STAFF_NOT_ASSIGNED']);

export const eventParamsSchema = z.object({ eventId: id });
export const assignmentParamsSchema = z.object({ assignmentId: id });
export const scanSchema = z.object({ code: z.string().trim().min(1).max(512) }).strict();

export const assignmentListQuerySchema = z.object({
  segment: z.enum(['all', 'open', 'upcoming', 'history']).default('all'),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const assignmentLogsQuerySchema = z.object({
  result: checkinResult.optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type AssignmentListQuery = z.infer<typeof assignmentListQuerySchema>;
export type AssignmentLogsQuery = z.infer<typeof assignmentLogsQuerySchema>;
