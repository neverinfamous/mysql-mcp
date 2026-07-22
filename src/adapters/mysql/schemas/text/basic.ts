import { z } from "zod";
import { defaultToEmpty } from "../preprocess-utils.js";

// --- RegexpMatch ---
export const RegexpMatchSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Required)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name (Required)"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.union([z.string(), z.number()]).optional().describe("Regular expression pattern (Required)"),
  query: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  sql: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  value: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  search: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  regex: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  regexp: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumn: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .describe(
      "Include source column in output (default: false). Set to true for full context.",
    ),
  limit: z.union([z.string(), z.number()]).optional().describe("Maximum number of rows to return (default: 50)"),
});

export const RegexpMatchSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      sql: z.coerce.string().optional(),
      value: z.coerce.string().optional(),
      search: z.coerce.string().optional(),
      regex: z.coerce.string().optional(),
      regexp: z.coerce.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumn: z.union([z.boolean(), z.string()]).transform(v => v === "true" || v === true).optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? data.table_name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern ?? data.query ?? data.sql ?? data.value ?? data.search ?? data.regex ?? data.regexp ?? "",
    where: data.where || data.filter || undefined,
    includeSourceColumn: data.includeSourceColumn,
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
      data.limit === undefined ||
      (!Number.isNaN(data.limit) && Number.isInteger(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

// --- LikeSearch ---
export const LikeSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Required)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name (Required)"),
  col: z.string().optional().describe("Alias for column"),
  pattern: z.union([z.string(), z.number()]).optional().describe("LIKE pattern with % and _ wildcards (Required)"),
  query: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  sql: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  value: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  search: z.union([z.string(), z.number()]).optional().describe("Alias for pattern"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumn: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .describe(
      "Include source column in output (default: false). Set to true for full context.",
    ),
  limit: z.union([z.string(), z.number()]).optional().describe("Maximum number of rows to return (default: 50)"),
});

export const LikeSearchSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      pattern: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      sql: z.coerce.string().optional(),
      value: z.coerce.string().optional(),
      search: z.coerce.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumn: z.union([z.boolean(), z.string()]).transform(v => v === "true" || v === true).optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? data.table_name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern ?? data.query ?? data.sql ?? data.value ?? data.search ?? "",
    where: data.where || data.filter || undefined,
    includeSourceColumn: data.includeSourceColumn,
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
      data.limit === undefined ||
      (!Number.isNaN(data.limit) && Number.isInteger(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

// --- Soundex ---
export const SoundexSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Required)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name (Required)"),
  col: z.string().optional().describe("Alias for column"),
  value: z.union([z.string(), z.number()]).optional().describe("Value to match phonetically (Required)"),
  query: z.union([z.string(), z.number()]).optional().describe("Alias for value"),
  search: z.union([z.string(), z.number()]).optional().describe("Alias for value"),
  pattern: z.union([z.string(), z.number()]).optional().describe("Alias for value"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumn: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .describe(
      "Include source column in output (default: false). Set to true for full context.",
    ),
  limit: z.union([z.string(), z.number()]).optional().describe("Maximum number of rows to return (default: 50)"),
});

export const SoundexSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      value: z.coerce.string().optional(),
      query: z.coerce.string().optional(),
      search: z.coerce.string().optional(),
      pattern: z.coerce.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumn: z.union([z.boolean(), z.string()]).transform(v => v === "true" || v === true).optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? data.table_name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value ?? data.query ?? data.search ?? data.pattern ?? "",
    where: data.where || data.filter || undefined,
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
      data.limit === undefined ||
      (!Number.isNaN(data.limit) && Number.isInteger(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

// --- Substring ---
export const SubstringSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Note: Pass a table name, not a raw string) (Required)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name (Note: Pass a column name, not a raw string) (Required)"),
  col: z.string().optional().describe("Alias for column"),
  start: z.union([z.string(), z.number()]).optional().describe("Starting position (1-indexed) (Required)"),
  pos: z.union([z.string(), z.number()]).optional().describe("Alias for start"),
  position: z.union([z.string(), z.number()]).optional().describe("Alias for start"),
  length: z.union([z.string(), z.number()]).optional().describe("Number of characters"),
  len: z.union([z.string(), z.number()]).optional().describe("Alias for length"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumn: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .describe(
      "Include source column in output (default: false). Set to true for full context.",
    ),
  limit: z.union([z.string(), z.number()]).optional().describe("Maximum number of rows to return (default: 50)"),
});

export const SubstringSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      column: z.string().optional(),
      col: z.string().optional(),
      start: z.union([z.string(), z.number()]).optional(),
      pos: z.union([z.string(), z.number()]).optional(),
      position: z.union([z.string(), z.number()]).optional(),
      length: z.coerce.number().optional(),
      len: z.coerce.number().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumn: z.union([z.boolean(), z.string()]).transform(v => v === "true" || v === true).optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? data.table_name ?? "",
    column: data.column ?? data.col ?? "",
    start: data.start ?? data.pos ?? data.position,
    length: data.length ?? data.len,
    where: data.where || data.filter || undefined,
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
    { message: "start is required and must be a number" },
  )
  .transform((data) => ({
    ...data,
    start: Number(data.start),
  }))
  .refine(
    (data) =>
      data.limit === undefined ||
      (!Number.isNaN(data.limit) && Number.isInteger(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

// --- Concat ---
export const ConcatSchemaBase = z.object({
  table: z.string().optional().describe("Table name (Note: Pass a table name, not a raw string) (Required)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  columns: z.union([z.array(z.string()), z.string()]).optional().describe("Columns to concatenate (Note: Pass column names, not raw strings) (Required)"),
  cols: z.union([z.array(z.string()), z.string()]).optional().describe("Alias for columns"),
  column: z.union([z.array(z.string()), z.string()]).optional().describe("Alias for columns"),
  separator: z
    .string()
    .optional()
    .default(" ")
    .describe("Separator between values"),
  alias: z
    .string()
    .optional()
    .describe("Result column name (default: concatenated)"),
  as: z.string().optional().describe("Alias for alias"),
  where: z
    .string()
    .optional()
    .describe("Additional WHERE clause for filtering"),
  filter: z.string().optional().describe("Alias for where"),
  includeSourceColumns: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .describe(
      "Include individual source columns in output (default: false). Set to true for full context.",
    ),
  limit: z.union([z.string(), z.number()]).optional().describe("Maximum number of rows to return (default: 50)"),
});

export const ConcatSchema = z
  .preprocess(
    defaultToEmpty,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      columns: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? (v.length === 1 && typeof v[0] === "string" && v[0].includes(",") ? v[0].split(",").map(s => s.trim()) : v) : (typeof v === "string" && v.includes(",") ? v.split(",").map(s => s.trim()) : [v])).optional(),
      cols: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? (v.length === 1 && typeof v[0] === "string" && v[0].includes(",") ? v[0].split(",").map(s => s.trim()) : v) : (typeof v === "string" && v.includes(",") ? v.split(",").map(s => s.trim()) : [v])).optional(),
      column: z.union([z.array(z.string()), z.string()]).transform(v => Array.isArray(v) ? (v.length === 1 && typeof v[0] === "string" && v[0].includes(",") ? v[0].split(",").map(s => s.trim()) : v) : (typeof v === "string" && v.includes(",") ? v.split(",").map(s => s.trim()) : [v])).optional(),
      separator: z.string().optional().default(" "),
      alias: z.string().optional(),
      as: z.string().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      includeSourceColumns: z.union([z.boolean(), z.string()]).transform(v => v === "true" || v === true).optional().default(false),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? data.table_name ?? "",
    columns: data.columns ?? data.cols ?? data.column,
    separator: data.separator,
    alias: data.alias ?? data.as ?? "concatenated",
    where: data.where || data.filter || undefined,
    includeSourceColumns: data.includeSourceColumns,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine(
    (data) => Array.isArray(data.columns) && data.columns.length > 0,
    { message: "columns must be an array with at least one column" }
  )
  .transform((data) => ({
    ...data,
    columns: data.columns ?? [],
  }))
  .refine(
    (data) =>
      data.limit === undefined ||
      (!Number.isNaN(data.limit) && Number.isInteger(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );
