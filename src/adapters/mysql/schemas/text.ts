import { z } from "zod";
import {
  preprocessTableParams,
  preprocessJsonColumnParams,
  preprocessQueryOnlyParams,
} from "./preprocess-utils.js";

// =============================================================================
// Text Schemas
// =============================================================================

// --- RegexpMatch ---
export const RegexpMatchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.string().describe("Regular expression pattern"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const RegexpMatchSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
    limit: data.limit !== undefined ? Number(data.limit) : undefined,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine(
    (data) => data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" }
  );

// --- LikeSearch ---
export const LikeSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.string().describe("LIKE pattern with % and _ wildcards"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const LikeSearchSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
    limit: data.limit !== undefined ? Number(data.limit) : undefined,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine(
    (data) => data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" }
  );

// --- Soundex ---
export const SoundexSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  value: z.string().describe("Value to match phonetically"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const SoundexSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      value: z.string(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value,
    where: data.where ?? data.filter,
    limit: data.limit !== undefined ? Number(data.limit) : undefined,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine(
    (data) => data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" }
  );

// --- Substring ---
export const SubstringSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().describe("Column name"),
  start: z.unknown().describe("Starting position (1-indexed)"),
  length: z.unknown().optional().describe("Number of characters"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const SubstringSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string(),
      start: z.number(),
      length: z.number().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column,
    start: data.start,
    length: data.length,
    where: data.where ?? data.filter,
    limit: data.limit !== undefined ? Number(data.limit) : undefined,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine(
    (data) => data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" }
  );

// --- Concat ---
export const ConcatSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).describe("Columns to concatenate"),
  separator: z
    .string()
    .optional()
    .default(" ")
    .describe("Separator between values"),
  alias: z
    .string()
    .optional()
    .default("concatenated")
    .describe("Result column name"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumns: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Include individual source columns in output (default: true). Set to false for minimal payload.",
    ),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const ConcatSchema = z
  .preprocess(
    preprocessJsonColumnParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()),
      separator: z.string().optional().default(" "),
      alias: z.string().optional().default("concatenated"),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumns: z.boolean().optional().default(true),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns,
    separator: data.separator,
    alias: data.alias,
    where: data.where ?? data.filter,
    includeSourceColumns: data.includeSourceColumns,
    limit: data.limit !== undefined ? Number(data.limit) : undefined,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine(
    (data) => data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" }
  );

// --- CollationConvert ---
export const CollationConvertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  charset: z.string().describe("Target character set (e.g., utf8mb4)"),
  targetCharset: z.string().optional().describe("Alias for charset"),
  collation: z.string().optional().describe("Target collation"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const CollationConvertSchema = z
  .preprocess(
    (val) => {
      const v1 = preprocessJsonColumnParams(val);
      // Alias targetCharset to charset
      if (v1 !== null && typeof v1 === "object" && "targetCharset" in v1 && !("charset" in v1)) {
        (v1 as Record<string, unknown>)["charset"] = (v1 as Record<string, unknown>)["targetCharset"];
      }
      return v1;
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      charset: z.string(),
      collation: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    charset: data.charset,
    collation: data.collation,
    where: data.where ?? data.filter,
    limit: data.limit !== undefined ? Number(data.limit) : undefined,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine(
    (data) => data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" }
  );

// --- FulltextCreate ---
export const FulltextCreateSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to include in index"),
  indexName: z.string().optional().describe("Optional index name"),
});

export const FulltextCreateSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      indexName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    indexName: data.indexName,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
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
    .describe("Optional max characters per text column in results. Truncates with '...' if exceeded."),
  limit: z.unknown().optional().describe("Alias for maxLength"),
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
      query: z.string().optional(),
      sql: z.string().optional(),
      mode: z
        .enum(["NATURAL", "BOOLEAN", "EXPANSION"])
        .optional()
        .default("NATURAL"),
      maxLength: z.unknown().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? data.sql ?? "",
    mode: data.mode,
    maxLength: data.maxLength !== undefined ? Number(data.maxLength) : (data.limit !== undefined ? Number(data.limit) : undefined),
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  })
  .refine(
    (data) => data.maxLength === undefined || (!Number.isNaN(data.maxLength) && data.maxLength > 0),
    { message: "Validation error: maxLength (or limit) must be a positive number" }
  );

// --- FulltextDrop ---
export const FulltextDropSchemaBase = z.object({
  table: z.string().optional().describe("Table containing the index"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  indexName: z
    .string()
    .optional()
    .describe("Name of the FULLTEXT index to drop"),
});

export const FulltextDropSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      indexName: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    indexName: data.indexName ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
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
  limit: z.unknown().optional().describe("Alias for maxLength"),
});

export const FulltextBooleanSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      query: z.string().optional(),
      maxLength: z.unknown().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength !== undefined ? Number(data.maxLength) : (data.limit !== undefined ? Number(data.limit) : undefined),
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query is required" })
  .refine(
    (data) => data.maxLength === undefined || (!Number.isNaN(data.maxLength) && data.maxLength > 0),
    { message: "Validation error: maxLength (or limit) must be a positive number" }
  );

// --- FulltextExpand ---
export const FulltextExpandSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  query: z.string().optional().describe("Search query to expand"),
  maxLength: z
    .unknown()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
    ),
  limit: z.unknown().optional().describe("Alias for maxLength"),
});

export const FulltextExpandSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.array(z.string()).optional(),
      query: z.string().optional(),
      maxLength: z.unknown().optional(),
      limit: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength !== undefined ? Number(data.maxLength) : (data.limit !== undefined ? Number(data.limit) : undefined),
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query is required" })
  .refine(
    (data) => data.maxLength === undefined || (!Number.isNaN(data.maxLength) && data.maxLength > 0),
    { message: "Validation error: maxLength (or limit) must be a positive number" }
  );
