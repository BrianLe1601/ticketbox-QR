import { z } from "zod";

export const staffIdParamsSchema = z.object({ staffId: z.coerce.number().int().positive() });
export const assignmentParamsSchema = staffIdParamsSchema.extend({
  assignmentId: z.coerce.number().int().positive(),
});
export const staffStatusSchema = z.object({
  action: z.enum(["approve", "reject", "deactivate", "reactivate"]),
});
export const staffProfileSchema = z.object({ fullName: z.string().trim().min(2).max(100) });
export const staffAssignmentSchema = z.object({ eventId: z.number().int().positive() });
