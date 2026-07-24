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
  filepath: z.string().optional().describe("FORBIDDEN: Do not pass a filepath. Tool returns data directly."),
  file: z.string().optional().describe("FORBIDDEN: Do not pass a file. Tool returns data directly."),
  path: z.string().optional().describe("FORBIDDEN: Do not pass a path. Tool returns data directly."),
  format: z
    .enum(["SQL", "CSV", "JSON", "sql", "csv", "json"])
    .transform((val) => val.toUpperCase() as "SQL" | "CSV" | "JSON")
    .optional()
    .default("SQL")
    .describe("Export format"),
  where: z.string().optional().describe("WHERE clause to filter rows"),
  filter: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  limit: z.coerce
    .number()
    .optional()
    .describe(
      "Maximum number of rows to export (default: 5). Set higher to export more rows.",
    ),
  batch: z.coerce
    .number()
    .optional()
    .describe(
      "Rows per INSERT statement (default: 50). Higher values produce multi-row INSERT ... VALUES (...), (...) for smaller payloads.",
    ),
});

export const ExportTableSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      filepath: z.any().optional(),
      file: z.any().optional(),
      path: z.any().optional(),
      format: z
        .enum(["SQL", "CSV", "JSON", "sql", "csv", "json"])
        .transform((val) => val.toUpperCase() as "SQL" | "CSV" | "JSON")
        .optional()
        .default("SQL"),
      where: z.string().optional(),
      filter: z.string().optional(),
      query: z.string().optional(),
      condition: z.string().optional(),
      limit: z.unknown().optional(),
      batch: z.unknown().optional(),
    }),
  )
  .refine(
    (data) => data.filepath === undefined && data.file === undefined && data.path === undefined,
    { message: "Do not pass filepath, file, or path. This tool returns data directly in the response payload and does not write to a file." }
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    format: data.format,
    where: data.where ?? data.filter ?? data.query ?? data.condition,
    limit: data.limit !== undefined ? Number(data.limit) : 5,
    batch: data.batch !== undefined ? Number(data.batch) : 50,
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
  tbl: z.string().optional().describe("Alias for table"),
  filepath: z.string().optional().describe("FORBIDDEN: Do not pass a filepath. Tool accepts raw data arrays."),
  file: z.string().optional().describe("FORBIDDEN: Do not pass a file. Tool accepts raw data arrays."),
  path: z.string().optional().describe("FORBIDDEN: Do not pass a path. Tool accepts raw data arrays."),
  data: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe("Array of row objects to insert. (Do NOT pass a filepath string. To import a .sql file, use shell.importTable)"),
  rows: z.array(z.record(z.string(), z.unknown())).optional().describe("Alias for data"),
  values: z.array(z.record(z.string(), z.unknown())).optional().describe("Alias for data"),
  items: z.array(z.record(z.string(), z.unknown())).optional().describe("Alias for data"),
});

export const ImportDataSchema = z
  .preprocess(
    (input) => {
      const data = preprocessTableParams(input);
      if (typeof data !== "object" || data === null) return data;
      const rec = data as Record<string, unknown>;
      for (const key of ["data", "rows", "values", "items"]) {
        if (typeof rec[key] === "string") {
          try {
            rec[key] = JSON.parse(rec[key]);
          } catch {
            // Ignored
          }
        }
      }
      return rec;
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      filepath: z.any().optional(),
      file: z.any().optional(),
      path: z.any().optional(),
      data: z.array(z.record(z.string(), z.unknown())).optional(),
      rows: z.array(z.record(z.string(), z.unknown())).optional(),
      values: z.array(z.record(z.string(), z.unknown())).optional(),
      items: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
  )
  .refine(
    (data) => data.filepath === undefined && data.file === undefined && data.path === undefined,
    { message: "Do not pass filepath, file, or path. This tool accepts raw data arrays directly in the 'data' property. To import a .sql file natively, use shell.importTable." }
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? "",
    data: data.data ?? data.rows ?? data.values ?? data.items ?? [],
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name/tbl alias) is required",
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
