import { z } from "zod";

export const venueSchema = z.object({
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(255),
  city: z.string().trim().min(1).max(100),
  capacity: z.number().int().positive().max(1_000_000),
}).strict();

export const categoryScopeSchema = z.object({
  scope: z.enum(["music_only", "all"]),
}).strict();

export type VenueInput = z.infer<typeof venueSchema>;
export type CategoryScopeInput = z.infer<typeof categoryScopeSchema>;
