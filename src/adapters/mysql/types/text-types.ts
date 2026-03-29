import { z } from "zod";
import { preprocessTableParams, preprocessJsonColumnParams, preprocessQueryOnlyParams } from "./preprocessors.js";

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
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

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
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

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
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

// --- Substring ---
export const SubstringSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().describe("Column name"),
  start: z.number().describe("Starting position (1-indexed)"),
  length: z.number().optional().describe("Number of characters"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
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
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column,
    start: data.start,
    length: data.length,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

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
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns,
    separator: data.separator,
    alias: data.alias,
    where: data.where ?? data.filter,
    includeSourceColumns: data.includeSourceColumns,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- CollationConvert ---
export const CollationConvertSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  charset: z.string().describe("Target character set (e.g., utf8mb4)"),
  collation: z.string().optional().describe("Target collation"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
});

export const CollationConvertSchema = z
  .preprocess(
    preprocessJsonColumnParams,
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
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    charset: data.charset,
    collation: data.collation,
    where: data.where ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  });

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
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? data.sql ?? "",
    mode: data.mode,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

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
    .number()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
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
      query: z.string().optional(),
      maxLength: z.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query is required" });

// --- FulltextExpand ---
export const FulltextExpandSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to search"),
  query: z.string().optional().describe("Search query to expand"),
  maxLength: z
    .number()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
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
      query: z.string().optional(),
      maxLength: z.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns ?? [],
    query: data.query ?? "",
    maxLength: data.maxLength,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.columns.length > 0, { message: "columns is required" })
  .refine((data) => data.query !== "", { message: "query is required" });

