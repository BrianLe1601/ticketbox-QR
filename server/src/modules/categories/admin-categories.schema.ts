import { z } from "zod";

const slug = z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const categoryIdSchema = z.object({ id: z.coerce.number().int().positive() });
export const categoryListSchema = z.object({
  includeInactive: z.enum(["true", "false"]).transform((value) => value === "true").default(false),
});

// Fields without defaults. Zod 4 applies defaults even inside .partial(), so the
// update schema must be derived from this base: otherwise renaming a Category
// would silently reset is_active, kind and sort_order.
const categoryFields = z.object({
  name: z.string().trim().min(2).max(100),
  slug,
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  kind: z.enum(["music", "other"]),
  sortOrder: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
});

export const createCategorySchema = categoryFields.extend({
  kind: categoryFields.shape.kind.default("other"),
  sortOrder: categoryFields.shape.sortOrder.default(0),
  isActive: categoryFields.shape.isActive.default(true),
}).strict();
export const updateCategorySchema = categoryFields.partial().strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
