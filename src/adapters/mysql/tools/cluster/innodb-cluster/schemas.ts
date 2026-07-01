import { z } from "zod";
import { SummarySchemaBase } from "../../../schemas/cluster.js";

export const SummarySchema = z.preprocess((val) => {
  if (val === null || val === undefined || typeof val !== "object") {
    return val;
  }
  return val;
}, SummarySchemaBase);

export const LimitSchema = z.preprocess((val) => {
  if (val === null || val === undefined || typeof val !== "object") {
    return val;
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
