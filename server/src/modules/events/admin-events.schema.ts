import { z } from "zod";

const categorySchema = z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
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

// Venue fields are never typed per Event: new Events copy the platform venue.
// syncVenue re-applies the current platform venue to an Event that has no sales;
// a published Event is already public, so it also needs an explicit confirmation.
export const updateAdminEventSchema = createAdminEventSchema.partial().extend({
  syncVenue: z.boolean().optional(),
  confirmPublicVenueChange: z.boolean().optional(),
}).strict();

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
