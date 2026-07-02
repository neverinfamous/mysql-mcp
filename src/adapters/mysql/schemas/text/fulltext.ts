import { z } from "zod";
import {
  preprocessTableParams,
  preprocessQueryOnlyParams,
  defaultToEmpty,
} from "../preprocess-utils.js";

function preprocessFulltextParams(val: unknown): unknown {
  const v1 = preprocessTableParams(val);
  const v2 = preprocessQueryOnlyParams(v1);
  if (v2 !== null && typeof v2 === "object") {
    const v = v2 as Record<string, unknown>;
    // Agents often pass fulltextSearch(table, query, columns) resulting in:
    // columns = query (string), query = columns (array)
    if (typeof v["columns"] === "string" && Array.isArray(v["query"])) {
      const temp = v["columns"];
      v["columns"] = v["query"];
      v["query"] = temp;
    }
    // Also if they alias 'query' as 'sql', let's check sql too
    else if (typeof v["columns"] === "string" && Array.isArray(v["sql"])) {
      const temp = v["columns"];
      v["columns"] = v["sql"];
      v["sql"] = temp;
    }
    // If it is just a string, wrap it in an array
    else if (typeof v["columns"] === "string") {
      v["columns"] = [v["columns"]];
    }
    
    if (typeof v["col"] === "string") v["col"] = [v["col"]];
    if (typeof v["column"] === "string") v["column"] = [v["column"]];
  }
  return v2;
}

function preprocessFulltextCreateParams(val: unknown): unknown {
  const v = defaultToEmpty(val);
  if (v !== null && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["columns"] === "string") obj["columns"] = [obj["columns"]];
    if (typeof obj["col"] === "string") obj["col"] = [obj["col"]];
    if (typeof obj["column"] === "string") obj["column"] = [obj["column"]];
  }
  return v;
}

// --- FulltextCreate ---
export const FulltextCreateSchemaBase = z.object({
  table: z.string().optional().describe("Table name. REQUIRED."),
  tableName: z.string().optional().describe("Alias for table"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in index. REQUIRED. Note: must be an array (e.g. ['col1'])."),
  indexName: z.string().optional().describe("Optional index name"),
  index_name: z.string().optional().describe("Alias for indexName"),
  name: z.string().optional().describe("Alias for indexName"),
  index: z.string().optional().describe("Alias for indexName"),
});

export const FulltextCreateSchema = z
  .preprocess(
    preprocessFulltextCreateParams,
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
  table: z.string().optional().describe("Table name. REQUIRED."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search. REQUIRED. Note: must be an array (e.g. ['col1'])."),
  col: z.array(z.string()).optional().describe("Alias for columns"),
  column: z.array(z.string()).optional().describe("Alias for columns"),
  query: z.string().optional().describe("Search query. REQUIRED. Note: must be a string, not an array."),
  sql: z.string().optional().describe("Alias for query"),
  search: z.string().optional().describe("Alias for query"),
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
    preprocessFulltextParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      col: z.array(z.string()).optional(),
      column: z.array(z.string()).optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      search: z.string().optional(),
      mode: z.preprocess(
        (val) => (typeof val === "string" ? val.toUpperCase() : val),
        z.enum(["NATURAL", "BOOLEAN", "EXPANSION"]).optional().default("NATURAL")
      ),
      maxLength: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      includeFacets: z.boolean().optional().default(false),
      cursor: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? data.col ?? data.column ?? [],
    query: data.query ?? data.sql ?? data.search ?? "",
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
  .refine((data) => data.query !== "", { message: "query (or sql/search alias) is required" })
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
  table: z.string().optional().describe("Table containing the index. REQUIRED."),
  tableName: z.string().optional().describe("Alias for table"),
  indexName: z
    .string()
    .optional()
    .describe("Name of the FULLTEXT index to drop. REQUIRED."),
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
  table: z.string().optional().describe("Table name. REQUIRED."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search. REQUIRED. Note: must be an array (e.g. ['col1'])."),
  col: z.array(z.string()).optional().describe("Alias for columns"),
  column: z.array(z.string()).optional().describe("Alias for columns"),
  query: z
    .string()
    .optional()
    .describe("Boolean search query with +, -, *, etc. REQUIRED. Note: must be a string, not an array."),
  sql: z.string().optional().describe("Alias for query"),
  search: z.string().optional().describe("Alias for query"),
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
    preprocessFulltextParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      col: z.array(z.string()).optional(),
      column: z.array(z.string()).optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      search: z.string().optional(),
      maxLength: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      includeFacets: z.boolean().optional().default(false),
      cursor: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? data.col ?? data.column ?? [],
    query: data.query ?? data.sql ?? data.search ?? "",
    maxLength: data.maxLength,
    limit: data.limit,
    includeFacets: data.includeFacets,
    cursor: data.cursor,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query (or sql/search alias) is required" })
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
  table: z.string().optional().describe("Table name. REQUIRED."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search. REQUIRED. Note: must be an array (e.g. ['col1'])."),
  col: z.array(z.string()).optional().describe("Alias for columns"),
  column: z.array(z.string()).optional().describe("Alias for columns"),
  query: z.string().optional().describe("Search query to expand. REQUIRED. Note: must be a string, not an array."),
  sql: z.string().optional().describe("Alias for query"),
  search: z.string().optional().describe("Alias for query"),
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
    preprocessFulltextParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      col: z.array(z.string()).optional(),
      column: z.array(z.string()).optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      search: z.string().optional(),
      maxLength: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
      includeFacets: z.boolean().optional().default(false),
      cursor: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? data.col ?? data.column ?? [],
    query: data.query ?? data.sql ?? data.search ?? "",
    maxLength: data.maxLength,
    limit: data.limit,
    includeFacets: data.includeFacets,
    cursor: data.cursor,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query (or sql/search alias) is required" })
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
