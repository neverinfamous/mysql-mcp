import { z } from "zod";
import { preprocessTableParams } from "./preprocess-utils.js";

// =============================================================================
// Backup Schemas
// =============================================================================

// --- ExportTable ---
export const ExportTableSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  format: z
    .enum(["SQL", "CSV", "JSON", "sql", "csv", "json"])
    .transform((val) => val.toUpperCase() as "SQL" | "CSV" | "JSON")
    .optional()
    .default("SQL")
    .describe("Export format"),
  where: z.string().optional().describe("WHERE clause to filter rows"),
  filter: z.string().optional().describe("Alias for where"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of rows to export (default: 5). Set higher to export more rows.",
    ),
  batch: z
    .unknown()
    .optional()
    .describe(
      "Rows per INSERT statement (default: 1). Higher values produce multi-row INSERT ... VALUES (...), (...) for smaller payloads.",
    ),
});

export const ExportTableSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      format: z
        .enum(["SQL", "CSV", "JSON", "sql", "csv", "json"])
        .transform((val) => val.toUpperCase() as "SQL" | "CSV" | "JSON")
        .optional()
        .default("SQL"),
      where: z.string().optional(),
      filter: z.string().optional(),
      limit: z.unknown().optional(),
      batch: z.unknown().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    format: data.format,
    where: data.where ?? data.filter,
    limit: data.limit !== undefined ? Number(data.limit) : 5,
    batch: data.batch !== undefined ? Number(data.batch) : 1,
  }))
  .refine(
    (data) =>
      !Number.isNaN(data.limit) &&
      Number.isInteger(data.limit) &&
      data.limit > 0,
    { message: "limit must be a positive integer" },
  )
  .refine(
    (data) =>
      !Number.isNaN(data.batch) &&
      Number.isInteger(data.batch) &&
      data.batch > 0,
    { message: "batch must be a positive integer" },
  )
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- ImportData ---
export const ImportDataSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  data: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Array of row objects to insert"),
});

export const ImportDataSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      data: z.array(z.record(z.string(), z.unknown())),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    data: data.data,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// =============================================================================
// Output Schemas
// =============================================================================

import { BaseOutputSchema } from "./output-schemas.js";

export const ExportTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    csv: z.string().optional(),
    json: z.string().optional(),
    sql: z.string().optional(),
    rowCount: z.number()
  }).optional()
});

export const ImportDataOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    rowsInserted: z.number()
  }).optional()
});

export const CreateDumpOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    command: z.string(),
    note: z.string()
  }).optional()
});

export const RestoreDumpOutputSchema = CreateDumpOutputSchema;
