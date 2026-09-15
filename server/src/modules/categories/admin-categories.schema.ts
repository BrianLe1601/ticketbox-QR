import { z } from "zod";

const slug = z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const categoryIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const categoryListSchema = z.object({
  includeInactive: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
});
export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug,
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
}).strict();
export const updateCategorySchema = createCategorySchema.partial().strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
