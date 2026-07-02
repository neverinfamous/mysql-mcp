import { z } from "zod";
import { SummarySchemaBase } from "../../../schemas/cluster.js";

export const SummarySchema = z.preprocess((val) => {
  if (typeof val === "boolean") {
    return { summary: val };
  }
  if (typeof val === "string") {
    return { summary: val === "true" };
  }
  return val;
}, SummarySchemaBase);

export const LimitSchema = z.preprocess((val) => {
  if (typeof val === "number") {
    return { limit: val };
  }
  if (typeof val === "string") {
    const num = parseInt(val, 10);
    if (!isNaN(num)) return { limit: num };
  }
  return val;
}, z.object({
  limit: z
    .number()
    .int("Expected positive integer")
    .positive("Expected positive integer")
    .optional()
    .default(100),
}));
