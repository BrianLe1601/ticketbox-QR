import { z } from "zod";

const categorySchema = z.enum(["music", "conference", "food", "sports", "art"]);
const statusSchema = z.enum(["draft", "published", "ongoing", "completed", "cancelled"]);
const optionalDate = z.string().datetime({ offset: true }).nullable().optional();
const requiredDate = z.string().datetime({ offset: true });

export const adminEventIdSchema = z.object({ id: z.coerce.number().int().positive() });

export const adminEventListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: statusSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const createAdminEventSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  category: categorySchema,
  venue: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(255),
  city: z.string().trim().min(1).max(100),
  venueCapacity: z.number().int().positive(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
  coverImagePublicId: z.string().trim().max(255).nullable().optional(),
  coverImageAlt: z.string().trim().max(255).nullable().optional(),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  salesStartAt: requiredDate,
  salesEndAt: requiredDate,
  checkinStartAt: requiredDate,
  checkinEndAt: requiredDate,
  scheduledPublishAt: optionalDate,
}).strict();

export const updateAdminEventSchema = createAdminEventSchema.partial().strict();

export const schedulePublishSchema = z.object({
  scheduledPublishAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export const cancelEventSchema = z.object({
  reason: z.string().trim().min(10).max(500),
}).strict();

export const eventVisibilitySchema = z.discriminatedUnion("visible", [
  z.object({ visible: z.literal(true), reason: z.null().optional() }).strict(),
  z.object({ visible: z.literal(false), reason: z.string().trim().min(5).max(500) }).strict(),
]);

export type AdminEventListInput = z.infer<typeof adminEventListSchema>;
export type CreateAdminEventInput = z.infer<typeof createAdminEventSchema>;
export type UpdateAdminEventInput = z.infer<typeof updateAdminEventSchema>;
