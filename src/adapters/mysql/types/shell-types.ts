/**
 * MySQL Shell Tool Type Definitions
 *
 * Zod schemas for MySQL Shell tool inputs.
 * Tools execute mysqlsh as a subprocess to access util.* functions.
 */

import { z } from "zod";

// =============================================================================
// Helper for boolean coercion (handles string "true"/"false" from MCP clients)
// =============================================================================

const booleanCoerce = z.preprocess((val) => {
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
  }
  return val;
}, z.boolean());

// =============================================================================
// Base Schema
// =============================================================================

export const ShellBaseInputSchema = z
  .object({})
  .describe("MySQL Shell base input");

// =============================================================================
// Info Tools
// =============================================================================

export const ShellVersionInputSchema = z
  .object({})
  .describe("Get MySQL Shell version and status");

// =============================================================================
// Utility Tools
// =============================================================================

export const ShellCheckUpgradeInputSchema = z
  .object({
    targetVersion: z
      .string()
      .optional()
      .describe(
        'Target MySQL version to check compatibility for (e.g., "8.0.40", "8.4.0")',
      ),
    outputFormat: z
      .enum(["TEXT", "JSON"])
      .optional()
      .default("JSON")
      .describe("Output format"),
  })
  .describe(
    "Check server upgrade compatibility using util.checkForServerUpgrade()",
  );

// =============================================================================
// Data Transfer Tools
// =============================================================================

export const ShellExportTableInputSchema = z
  .object({
    schema: z.string().describe("Source schema (database) name"),
    table: z.string().describe("Table name to export"),
    outputPath: z
      .string()
      .describe("Output file path (absolute path recommended)"),
    format: z
      .enum(["csv", "tsv", "json"])
      .optional()
      .default("csv")
      .describe("Export format"),
    where: z
      .string()
      .optional()
      .describe("WHERE clause for filtering rows (without WHERE keyword)"),
  })
  .describe("Export table to file using util.exportTable()");

export const ShellImportTableInputSchema = z
  .object({
    inputPath: z.string().describe("Input file path (absolute path)"),
    schema: z.string().describe("Target schema (database) name"),
    table: z.string().describe("Target table name"),
    threads: z
      .number()
      .int()
      .min(1)
      .max(128)
      .optional()
      .default(4)
      .describe("Number of parallel threads"),
    skipRows: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Number of header rows to skip"),
    columns: z
      .array(z.string())
      .optional()
      .describe("Column mapping for import"),
    fieldsTerminatedBy: z
      .string()
      .optional()
      .describe("Field delimiter (default: auto-detect)"),
    linesTerminatedBy: z.string().optional().describe("Line delimiter"),
    updateServerSettings: booleanCoerce
      .optional()
      .default(false)
      .describe(
        "Automatically enable local_infile on the server if disabled (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege)",
      ),
  })
  .describe("Parallel table import using util.importTable()");

export const ShellImportJSONInputSchema = z
  .object({
    inputPath: z.string().describe("JSON file path (absolute path)"),
    schema: z.string().describe("Target schema (database) name"),
    collection: z.string().describe("Target collection or table name"),
    tableColumn: z
      .string()
      .optional()
      .describe("Column name for JSON data when importing to table"),
    convertBsonTypes: booleanCoerce
      .optional()
      .default(false)
      .describe("Convert BSON types from MongoDB exports"),
  })
  .describe("Import JSON documents using util.importJson()");

// =============================================================================
// Backup Tools
// =============================================================================

export const ShellDumpInstanceInputSchema = z
  .object({
    outputDir: z
      .string()
      .describe("Output directory for dump (must be empty or non-existent)"),
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

export const ShellDumpSchemasInputSchema = z
  .object({
    schemas: z.array(z.string()).min(1).describe("Schema names to dump"),
    outputDir: z.string().describe("Output directory for dump"),
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

export const ShellDumpTablesInputSchema = z
  .object({
    schema: z.string().describe("Schema containing tables"),
    tables: z.array(z.string()).min(1).describe("Table names to dump"),
    outputDir: z.string().describe("Output directory for dump"),
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
    all: booleanCoerce
      .optional()
      .default(false)
      .describe(
        "Dump all metadata for tables (triggers, etc.). Set to false if lacking privileges.",
      ),
  })
  .describe("Dump specific tables using util.dumpTables()");

// =============================================================================
// Restore Tools
// =============================================================================

export const ShellLoadDumpInputSchema = z
  .object({
    inputDir: z.string().describe("Directory containing MySQL Shell dump"),
    threads: z
      .number()
      .int()
      .min(1)
      .max(128)
      .optional()
      .default(4)
      .describe("Number of parallel threads"),
    dryRun: booleanCoerce
      .optional()
      .default(false)
      .describe("Simulate load without executing"),
    includeSchemas: z
      .array(z.string())
      .optional()
      .describe("Schemas to include"),
    excludeSchemas: z
      .array(z.string())
      .optional()
      .describe("Schemas to exclude"),
    includeTables: z
      .array(z.string())
      .optional()
      .describe("Tables to include (schema.table format)"),
    excludeTables: z.array(z.string()).optional().describe("Tables to exclude"),
    ignoreExistingObjects: booleanCoerce
      .optional()
      .default(false)
      .describe("Ignore existing objects instead of failing"),
    ignoreVersion: booleanCoerce
      .optional()
      .default(false)
      .describe("Ignore version mismatch between dump and server"),
    resetProgress: booleanCoerce
      .optional()
      .default(false)
      .describe("Reset progress tracking and reload from start"),
    updateServerSettings: booleanCoerce
      .optional()
      .default(false)
      .describe(
        "Automatically enable local_infile on the server if disabled (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege)",
      ),
  })
  .describe("Load dump to instance using util.loadDump()");

// =============================================================================
// Scripting Tools
// =============================================================================

export const ShellRunScriptInputSchema = z
  .object({
    script: z.string().min(1).describe("Script content to execute"),
    language: z
      .enum(["js", "py", "sql"])
      .describe("Script language (JavaScript, Python, or SQL)"),
    timeout: z
      .number()
      .int()
      .min(1000)
      .max(3600000)
      .optional()
      .default(60000)
      .describe("Timeout in milliseconds (default: 60 seconds)"),
  })
  .describe("Execute JavaScript, Python, or SQL script via MySQL Shell");
