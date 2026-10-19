import { z } from "zod";

export const categoryIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const categoryListSchema = z.object({
  includeInactive: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
});

// The genre catalogue is fixed (installed by the schema): an Admin may only switch a
// Category on/off and reorder it. Name, slug, description, icon and kind are not
// accepted at all (strict), so a PATCH can never rename or reclassify a genre.
// No defaults here: Zod 4 would apply them inside .partial() and silently reset fields.
export const updateCategorySchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict().refine((value) => value.isActive !== undefined || value.sortOrder !== undefined, {
  message: "Provide isActive or sortOrder",
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
