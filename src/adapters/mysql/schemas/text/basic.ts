import { z } from "zod";
import { preprocessJsonColumnParams } from "../preprocess-utils.js";

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
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
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
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    pattern: data.pattern,
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
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
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column ?? data.col ?? "",
    value: data.value,
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or col alias) is required",
  })
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
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
      start: z.coerce.number(),
      length: z.coerce.number().optional(),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    column: data.column,
    start: data.start,
    length: data.length,
    where: data.where ?? data.filter,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
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
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "Validation error: limit must be a positive number" },
  );
