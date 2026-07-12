import { z } from "zod";
import { SummarySchemaBase } from "../../../schemas/cluster.js";

export const SummarySchema = z.preprocess((val) => {
  if (typeof val === "boolean") {
    return { summary: val };
  }
  if (typeof val === "string") {
    if (val === "true") return { summary: true };
    if (val === "false") return { summary: false };
  }
  if (val !== null && typeof val === "object" && "summary" in val) {
    const v = val as Record<string, unknown>;
    if (typeof v["summary"] === "string") {
      if (v["summary"] === "true") return { ...val, summary: true };
      if (v["summary"] === "false") return { ...val, summary: false };
    }
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
  if (val !== null && typeof val === "object") {
    const v = val as Record<string, unknown>;
    let newLimit = v["limit"];
    if (typeof newLimit === "string") {
      const num = parseInt(newLimit, 10);
      if (!isNaN(num)) newLimit = num;
    }
    if (newLimit === undefined && "count" in v) {
      newLimit = v["count"];
    }
    return { ...val, limit: newLimit };
  }
  return val;
}, z.object({
  limit: z
    .number()
    .int("Expected positive integer")
    .positive("Expected positive integer")
    .optional()
    .default(100),
}).strict());
