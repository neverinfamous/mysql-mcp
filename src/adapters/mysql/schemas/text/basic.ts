import { z } from "zod";
import { defaultToEmpty } from "../preprocess-utils.js";

// --- RegexpMatch ---
export const RegexpMatchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.string().optional().describe("Regular expression pattern"),
  query: z.string().optional().describe("Alias for pattern"),
  sql: z.string().optional().describe("Alias for pattern"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const RegexpMatchSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern ?? data.query ?? data.sql ?? "",
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.pattern !== "", {
    message: "pattern (or query/sql alias) is required",
  })
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );

// --- LikeSearch ---
export const LikeSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.string().optional().describe("LIKE pattern with % and _ wildcards"),
  query: z.string().optional().describe("Alias for pattern"),
  sql: z.string().optional().describe("Alias for pattern"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const LikeSearchSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern ?? data.query ?? data.sql ?? "",
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.pattern !== "", {
    message: "pattern (or query/sql alias) is required",
  })
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );

// --- Soundex ---
export const SoundexSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name"),
  col: z.string().optional().describe("Alias for column"),
  value: z.string().optional().describe("Value to match phonetically"),
  query: z.string().optional().describe("Alias for value"),
  search: z.string().optional().describe("Alias for value"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumn: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Include source column in output (default: false). Set to true for full context.",
    ),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const SoundexSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      value: z.string().optional(),
      query: z.string().optional(),
      search: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumn: z.boolean().optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value ?? data.query ?? data.search ?? "",
    where: data.where ?? data.filter,
    includeSourceColumn: data.includeSourceColumn,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine((data) => data.value !== "", {
    message: "value (or query/search alias) is required",
  })
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );

// --- Substring ---
export const SubstringSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Note: Pass a table name, not a raw string)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name (Note: Pass a column name, not a raw string)"),
  col: z.string().optional().describe("Alias for column"),
  start: z.unknown().optional().describe("Starting position (1-indexed)"),
  length: z.unknown().optional().describe("Number of characters"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumn: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Include source column in output (default: false). Set to true for full context.",
    ),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const SubstringSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      start: z.union([z.string(), z.number()]).optional(),
      length: z.coerce.number().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumn: z.boolean().optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    start: data.start,
    length: data.length,
    where: data.where ?? data.filter,
    includeSourceColumn: data.includeSourceColumn,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine(
    (data) => data.start !== undefined && !Number.isNaN(Number(data.start)),
    { message: "Validation error: start is required and must be a number" },
  )
  .transform((data) => ({
    ...data,
    start: Number(data.start),
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );

// --- Concat ---
export const ConcatSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Note: Pass a table name, not a raw string)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z.array(z.string()).optional().describe("Columns to concatenate (Note: Pass column names, not raw strings)"),
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
    .default(false)
    .describe(
      "Include individual source columns in output (default: false). Set to true for full context.",
    ),
  limit: z.unknown().optional().describe("Maximum number of rows to return"),
});

export const ConcatSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      columns: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? v : [v]).optional(),
      separator: z.string().optional().default(" "),
      alias: z.string().optional().default("concatenated"),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumns: z.boolean().optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    columns: data.columns,
    separator: data.separator,
    alias: data.alias,
    where: data.where ?? data.filter,
    includeSourceColumns: data.includeSourceColumns,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine(
    (data) => Array.isArray(data.columns) && data.columns.length > 0,
    { message: "Validation error: columns must be an array with at least one column" }
  )
  .transform((data) => ({
    ...data,
    columns: data.columns ?? [],
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );
