import { z } from "zod";

const nullableDate = z.string().datetime({ offset:true }).nullable().optional();
export const ticketTypeIdSchema=z.object({id:z.coerce.number().int().positive()});
export const ticketTypeListSchema=z.object({eventId:z.coerce.number().int().positive()});
export const createTicketTypeSchema=z.object({
  eventId:z.number().int().positive(),name:z.string().trim().min(1).max(100),description:z.string().trim().max(500).nullable().optional(),
  price:z.number().min(0).max(9999999999.99),capacity:z.number().int().positive(),maxPerOrder:z.number().int().positive().max(100),
  salesStartAt:nullableDate,salesEndAt:nullableDate,isActive:z.boolean().default(true),
}).strict();
export const updateTicketTypeSchema=createTicketTypeSchema.omit({eventId:true}).partial().strict();
export const ticketSalesStatusSchema=z.object({active:z.boolean()}).strict();
export type CreateTicketTypeInput=z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput=z.infer<typeof updateTicketTypeSchema>;
