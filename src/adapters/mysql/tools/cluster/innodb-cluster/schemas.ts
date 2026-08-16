import { z } from "zod";

export const SummarySchemaBase = z.object({
  summary: z.union([z.boolean(), z.string()]).optional().describe("If true, return condensed output without configuration blobs"),
}).strict();

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
}, z.object({ summary: z.boolean().optional() }).strict());

export const LimitSchemaBase = z.object({
  limit: z
    .number()
    .int("Expected positive integer")
    .positive("Expected positive integer")
    .optional()
    .default(100),
}).strict();

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
    
    const cleaned = { ...val } as { count?: unknown; limit?: unknown; [key: string]: unknown };
    delete cleaned.count;
    cleaned.limit = newLimit;
    
    return cleaned;
  }
  return val;
}, LimitSchemaBase.strict());
