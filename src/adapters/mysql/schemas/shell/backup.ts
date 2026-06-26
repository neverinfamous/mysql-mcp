import { z } from "zod";
import { booleanCoerce } from "./base.js";

export const ShellDumpInstanceInputSchemaBase = z
  .object({
    outputDir: z
      .string()
      .optional()
      .describe("Output directory for dump (must be empty or non-existent)"),
    outputUrl: z.string().optional().describe("Alias for outputDir"),
    threads: z
      .number()
      .int()
      .min(1)
      .max(128)
      .optional()
      .default(4)
      .describe("Number of parallel threads"),
    compression: z
      .enum(["none", "zstd", "gzip"])
      .optional()
      .default("zstd")
      .describe("Compression method"),
    dryRun: booleanCoerce
      .optional()
      .default(false)
      .describe("Simulate dump without writing files"),
    includeSchemas: z
      .array(z.string())
      .optional()
      .describe("Schemas to include (default: all non-system)"),
    excludeSchemas: z
      .array(z.string())
      .optional()
      .describe("Schemas to exclude"),
    consistent: booleanCoerce
      .optional()
      .default(true)
      .describe("Use consistent snapshot"),
    users: booleanCoerce
      .optional()
      .default(true)
      .describe("Include user accounts and grants"),
  })
  .describe("Dump entire MySQL instance using util.dumpInstance()");

export const ShellDumpInstanceInputSchema = z
  .object({
    outputDir: z.string().optional(),
    outputUrl: z.string().optional(),
    threads: z.number().int().optional().default(4),
    compression: z.enum(["none", "zstd", "gzip"]).optional().default("zstd"),
    dryRun: booleanCoerce.optional().default(false),
    includeSchemas: z.array(z.string()).optional(),
    excludeSchemas: z.array(z.string()).optional(),
    consistent: booleanCoerce.optional().default(true),
    users: booleanCoerce.optional().default(true),
  });

export const ShellDumpSchemasInputSchemaBase = z
  .object({
    schemas: z.array(z.string()).optional().describe("Schema names to dump"),
    outputDir: z.string().optional().describe("Output directory for dump"),
    outputUrl: z.string().optional().describe("Alias for outputDir"),
    threads: z
      .number()
      .int()
      .min(1)
      .max(128)
      .optional()
      .default(4)
      .describe("Number of parallel threads"),
    compression: z
      .enum(["none", "zstd", "gzip"])
      .optional()
      .default("zstd")
      .describe("Compression method"),
    dryRun: booleanCoerce
      .optional()
      .default(false)
      .describe("Simulate dump without writing files"),
    includeTables: z
      .array(z.string())
      .optional()
      .describe("Tables to include (schema.table format)"),
    excludeTables: z
      .array(z.string())
      .optional()
      .describe("Tables to exclude (schema.table format)"),
    ddlOnly: booleanCoerce
      .optional()
      .default(false)
      .describe(
        "Dump only DDL (schema structure) without data or metadata requiring extra privileges (events, triggers, routines)",
      ),
  })
  .describe("Dump selected schemas using util.dumpSchemas()");

export const ShellDumpSchemasInputSchema = z
  .object({
    schemas: z.unknown().optional(),
    outputDir: z.string().optional(),
    outputUrl: z.string().optional(),
    threads: z.number().int().optional().default(4),
    compression: z.enum(["none", "zstd", "gzip"]).optional().default("zstd"),
    dryRun: booleanCoerce.optional().default(false),
    includeTables: z.array(z.string()).optional(),
    excludeTables: z.array(z.string()).optional(),
    ddlOnly: booleanCoerce.optional().default(false),
  })
  .transform((data) => ({
    ...data,
    schemas: Array.isArray(data.schemas) ? data.schemas.map(String) : [],
  }))
  .refine((data) => data.schemas.length > 0, {
    message: "At least one schema name is required",
  });

export const ShellDumpTablesInputSchemaBase = z
  .object({
    schema: z.string().optional().describe("Schema containing tables"),
    tables: z.array(z.string()).optional().describe("Table names to dump"),
    table: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for tables"),
    tableName: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for tables"),
    name: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for tables"),
    outputDir: z.string().optional().describe("Output directory for dump"),
    outputUrl: z.string().optional().describe("Alias for outputDir"),
    threads: z
      .number()
      .int()
      .min(1)
      .max(128)
      .optional()
      .default(4)
      .describe("Number of parallel threads"),
    compression: z
      .enum(["none", "zstd", "gzip"])
      .optional()
      .default("zstd")
      .describe("Compression method"),
    where: z
      .record(z.string(), z.string())
      .optional()
      .describe('WHERE clauses per table ({tableName: "condition"})'),
    dryRun: booleanCoerce
      .optional()
      .default(false)
      .describe("Simulate dump without writing files"),
    all: booleanCoerce
      .optional()
      .default(false)
      .describe(
        "Dump all metadata for tables (triggers, etc.). Set to false if lacking privileges.",
      ),
  })
  .describe("Dump specific tables using util.dumpTables()");

export const ShellDumpTablesInputSchema = z
  .object({
    schema: z.unknown().optional(),
    tables: z.unknown().optional(),
    table: z.unknown().optional(),
    tableName: z.unknown().optional(),
    name: z.unknown().optional(),
    outputDir: z.string().optional(),
    outputUrl: z.string().optional(),
    threads: z.number().int().optional().default(4),
    compression: z.enum(["none", "zstd", "gzip"]).optional().default("zstd"),
    where: z.record(z.string(), z.string()).optional(),
    dryRun: booleanCoerce.optional().default(false),
    all: booleanCoerce.optional().default(false),
  })
  .transform((data) => {
    const rawTables = data.tables ?? data.table ?? data.tableName ?? data.name;
    return {
      ...data,
      schema:
        typeof data.schema === "string"
          ? data.schema
          : typeof data.schema === "number" || typeof data.schema === "boolean"
            ? String(data.schema)
            : "",
      tables: Array.isArray(rawTables) 
        ? rawTables.map(String) 
        : typeof rawTables === "string" 
          ? [rawTables] 
          : [],
    };
  })
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.tables.length > 0, {
    message: "At least one table name is required",
  });
