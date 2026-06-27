import { z } from "zod";
import {
  preprocessTableParams,
  preprocessQueryOnlyParams,
  defaultToEmpty,
} from "../preprocess-utils.js";

// --- FulltextCreate ---
export const FulltextCreateSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in index"),
  indexName: z.string().optional().describe("Optional index name"),
  index_name: z.string().optional().describe("Alias for indexName"),
  name: z.string().optional().describe("Alias for indexName"),
  index: z.string().optional().describe("Alias for indexName"),
});

export const FulltextCreateSchema = z
  .preprocess(
    (val) => defaultToEmpty(val),
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      indexName: z.string().optional(),
      index_name: z.string().optional(),
      index: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? "",
    columns: data.columns ?? [],
    indexName: data.indexName ?? data.index_name ?? data.index ?? data.name,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.columns.length > 0, {
    message: "columns is required",
  });

// --- FulltextSearch ---
export const FulltextSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  col: z.array(z.string()).optional().describe("Alias for columns"),
  column: z.array(z.string()).optional().describe("Alias for columns"),
  query: z.string().optional().describe("Search query"),
  sql: z.string().optional().describe("Alias for query"),
  mode: z
    .enum(["NATURAL", "BOOLEAN", "EXPANSION"])
    .optional()
    .default("NATURAL")
    .describe("Search mode"),
  maxLength: z
    .unknown()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
    ),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
  includeFacets: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include per-column hit distribution in results"),
  cursor: z
    .string()
    .optional()
    .describe(
      "Opaque cursor for pagination (use nextCursor from previous response)",
    ),
});

export const FulltextSearchSchema = z
  .preprocess(
    (val) => {
      const v1 = preprocessTableParams(val);
      return preprocessQueryOnlyParams(v1);
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      col: z.array(z.string()).optional(),
      column: z.array(z.string()).optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      mode: z
        .enum(["NATURAL", "BOOLEAN", "EXPANSION"])
        .optional()
        .default("NATURAL"),
      maxLength: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      includeFacets: z.boolean().optional().default(false),
      cursor: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? data.col ?? data.column ?? [],
    query: data.query ?? data.sql ?? "",
    mode: data.mode,
    maxLength: data.maxLength,
    limit: data.limit,
    includeFacets: data.includeFacets,
    cursor: data.cursor,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine(
    (data) =>
      data.maxLength === undefined ||
      (!Number.isNaN(data.maxLength) && data.maxLength > 0),
    { message: "Validation error: maxLength must be a positive number" },
  )
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );

// --- FulltextDrop ---
export const FulltextDropSchemaBase = z.object({
  table: z.string().optional().describe("Table containing the index"),
  tableName: z.string().optional().describe("Alias for table"),
  indexName: z
    .string()
    .optional()
    .describe("Name of the FULLTEXT index to drop"),
  index_name: z.string().optional().describe("Alias for indexName"),
  name: z.string().optional().describe("Alias for indexName"),
  index: z.string().optional().describe("Alias for indexName"),
});

export const FulltextDropSchema = z
  .preprocess(
    (val) => defaultToEmpty(val),
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      indexName: z.string().optional(),
      index_name: z.string().optional(),
      index: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? "",
    indexName: data.indexName ?? data.index_name ?? data.index ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.indexName !== "", {
    message: "indexName is required",
  });

// --- FulltextBoolean ---
export const FulltextBooleanSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  col: z.array(z.string()).optional().describe("Alias for columns"),
  column: z.array(z.string()).optional().describe("Alias for columns"),
  query: z
    .string()
    .optional()
    .describe("Boolean search query with +, -, *, etc."),
  maxLength: z
    .unknown()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
    ),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
  includeFacets: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include per-column hit distribution in results"),
  cursor: z
    .string()
    .optional()
    .describe(
      "Opaque cursor for pagination (use nextCursor from previous response)",
    ),
});

export const FulltextBooleanSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      col: z.array(z.string()).optional(),
      column: z.array(z.string()).optional(),
      query: z.string().optional(),
      maxLength: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      includeFacets: z.boolean().optional().default(false),
      cursor: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? data.col ?? data.column ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength,
    limit: data.limit,
    includeFacets: data.includeFacets,
    cursor: data.cursor,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine(
    (data) =>
      data.maxLength === undefined ||
      (!Number.isNaN(data.maxLength) && data.maxLength > 0),
    { message: "Validation error: maxLength must be a positive number" },
  )
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );

// --- FulltextExpand ---
export const FulltextExpandSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  col: z.array(z.string()).optional().describe("Alias for columns"),
  column: z.array(z.string()).optional().describe("Alias for columns"),
  query: z.string().optional().describe("Search query to expand"),
  maxLength: z
    .unknown()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
    ),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
  includeFacets: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include per-column hit distribution in results"),
  cursor: z
    .string()
    .optional()
    .describe(
      "Opaque cursor for pagination (use nextCursor from previous response)",
    ),
});

export const FulltextExpandSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      col: z.array(z.string()).optional(),
      column: z.array(z.string()).optional(),
      query: z.string().optional(),
      maxLength: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      includeFacets: z.boolean().optional().default(false),
      cursor: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? data.col ?? data.column ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength,
    limit: data.limit,
    includeFacets: data.includeFacets,
    cursor: data.cursor,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine(
    (data) =>
      data.maxLength === undefined ||
      (!Number.isNaN(data.maxLength) && data.maxLength > 0),
    { message: "Validation error: maxLength must be a positive number" },
  )
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );
