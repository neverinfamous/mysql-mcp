import { z } from "zod";
import { preprocessJsonColumnParams } from "../preprocess-utils.js";

// --- JsonNormalize ---
export const JsonNormalizeSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  where: z.string().optional().describe("WHERE clause"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum rows to process"),
});

export const JsonNormalizeSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.number().default(100),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonStats ---
export const JsonStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  where: z.string().optional().describe("Optional WHERE clause"),
  filter: z.string().optional().describe("Alias for where"),
  sampleSize: z.unknown().optional().describe("Sample size for statistics"),
});

export const JsonStatsSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      sampleSize: z.number().default(1000),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    where: data.where ?? data.filter,
    sampleSize: data.sampleSize,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonIndexSuggest ---
export const JsonIndexSuggestSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("JSON column name"),
  col: z.string().optional().describe("Alias for column"),
  sampleSize: z.unknown().optional().describe("Sample size to analyze"),
});

export const JsonIndexSuggestSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      sampleSize: z.number().default(100),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    sampleSize: data.sampleSize,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- JsonValidate (no table/column — no aliases needed) ---
export const JsonValidateSchemaBase = z.object({
  value: z.unknown().optional().describe("JSON string to validate"),
});

export const JsonValidateSchema = z
  .object({
    value: z.unknown().optional(),
  })
  .transform((data) => ({
    value: data.value,
  }))
  .refine((data) => data.value !== undefined && data.value !== null, {
    message: "value is required",
  });

// --- JsonMerge ---
export const JsonMergeSchemaBase = z.object({
  json1: z.unknown().optional().describe("First JSON document"),
  doc1: z.unknown().optional().describe("Alias for json1"),
  json2: z.unknown().optional().describe("Second JSON document"),
  doc2: z.unknown().optional().describe("Alias for json2"),
  mode: z
    .enum(["patch", "preserve"])
    .optional()
    .describe("Merge mode: patch (RFC 7396) or preserve (array merge)"),
});

// --- JsonDiff ---
export const JsonDiffSchemaBase = z.object({
  json1: z.unknown().optional().describe("First JSON document"),
  doc1: z.unknown().optional().describe("Alias for json1"),
  json2: z.unknown().optional().describe("Second JSON document"),
  doc2: z.unknown().optional().describe("Alias for json2"),
});

export const JsonMergeSchema = z
  .object({
    json1: z.unknown().optional().describe("First JSON document"),
    doc1: z.unknown().optional().describe("Alias for json1"),
    json2: z.unknown().optional().describe("Second JSON document"),
    doc2: z.unknown().optional().describe("Alias for json2"),
    mode: z
      .enum(["patch", "preserve"])
      .default("patch")
      .describe("Merge mode: patch (RFC 7396) or preserve (array merge)"),
  })
  .transform((data) => {
    const val1 = data.json1 !== undefined ? data.json1 : data.doc1;
    const val2 = data.json2 !== undefined ? data.json2 : data.doc2;
    return {
      json1: typeof val1 === "string" ? val1 : JSON.stringify(val1),
      json2: typeof val2 === "string" ? val2 : JSON.stringify(val2),
      mode: data.mode,
      _raw1: val1,
      _raw2: val2,
    };
  })
  .refine((data) => data._raw1 !== undefined, {
    message: "json1 (or doc1 alias) is required",
  })
  .refine((data) => data._raw2 !== undefined, {
    message: "json2 (or doc2 alias) is required",
  });

export const JsonDiffSchema = z
  .object({
    json1: z.unknown().optional().describe("First JSON document"),
    doc1: z.unknown().optional().describe("Alias for json1"),
    json2: z.unknown().optional().describe("Second JSON document"),
    doc2: z.unknown().optional().describe("Alias for json2"),
  })
  .transform((data) => {
    const val1 = data.json1 !== undefined ? data.json1 : data.doc1;
    const val2 = data.json2 !== undefined ? data.json2 : data.doc2;
    return {
      json1: typeof val1 === "string" ? val1 : JSON.stringify(val1),
      json2: typeof val2 === "string" ? val2 : JSON.stringify(val2),
      _raw1: val1,
      _raw2: val2,
    };
  })
  .refine((data) => data._raw1 !== undefined, {
    message: "json1 (or doc1 alias) is required",
  })
  .refine((data) => data._raw2 !== undefined, {
    message: "json2 (or doc2 alias) is required",
  });

