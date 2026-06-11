import { z } from "zod";

export const SummarySchema = z.object({
  summary: z.boolean().optional(),
});

export const LimitSchema = z.object({
  limit: z
    .number()
    .int("Expected positive integer")
    .positive("Expected positive integer")
    .optional()
    .default(10),
});
