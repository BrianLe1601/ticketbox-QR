import { z } from 'zod';

export const listEventsQuerySchema = z.object({
    q: z.string().optional(),
    category: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    city: z.enum(['hcm', 'hn', 'dn']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    sort: z.enum(['upcoming', 'newest', 'price-asc', 'price-desc']).default('upcoming'),
});

export const eventIdParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
