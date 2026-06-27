/**
 * MySQL Shell Tool Type Definitions
 *
 * Zod schemas for MySQL Shell tool inputs.
 * Tools execute mysqlsh as a subprocess to access util.* functions.
 */

import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

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

export const ShellCheckUpgradeInputSchemaBase = z
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

export const ShellCheckUpgradeInputSchema = z
  .object({
    targetVersion: z.unknown().optional(),
    outputFormat: z.enum(["TEXT", "JSON"]).optional().default("JSON"),
  })
  .transform((data) => ({
    targetVersion:
      data.targetVersion === undefined
        ? undefined
        : String(data.targetVersion as string | number | boolean),
    outputFormat: data.outputFormat,
  }));

// =============================================================================
// Data Transfer Tools
// =============================================================================

export const ShellExportTableInputSchemaBase = z
  .object({
    schema: z.string().optional().describe("Source schema (database) name"),
    table: z.string().optional().describe("Table name to export"),
    outputPath: z
      .string()
      .optional()
      .describe("Output file path (absolute path recommended)"),
    outputUrl: z.string().optional().describe("Alias for outputPath"),
    format: z
      .enum(["csv", "tsv"])
      .optional()
      .default("csv")
      .describe("Export format (csv or tsv)"),
    where: z
      .string()
      .optional()
      .describe("WHERE clause for filtering rows (without WHERE keyword)"),
  })
  .describe("Export table to file using util.exportTable()");

export const ShellExportTableInputSchema = z
  .object({
    schema: z.unknown().optional(),
    table: z.unknown().optional(),
    outputPath: z.string().optional(),
    outputUrl: z.string().optional(),
    format: z.enum(["csv", "tsv"]).optional().default("csv"),
    where: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    schema:
      data.schema === undefined
        ? ""
        : String(data.schema as string | number | boolean),
    table:
      data.table === undefined
        ? ""
        : String(data.table as string | number | boolean),
  }))
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.table !== "", { message: "table must not be empty" });

export const ShellImportTableInputSchemaBase = z
  .object({
    inputPath: z
      .string()
      .optional()
      .describe("Input file path (absolute path)"),
    inputUrl: z.string().optional().describe("Alias for inputPath"),
    schema: z.string().optional().describe("Target schema (database) name"),
    table: z.string().optional().describe("Target table name"),
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
      .describe(
        "Column names to map input fields to, in order. Maps Nth field from file to Nth column name in this array",
      ),
    fieldsTerminatedBy: z
      .string()
      .optional()
      .describe(
        'Field delimiter. For CSV files, explicitly set to "," as delimiter is not auto-detected',
      ),
    linesTerminatedBy: z.string().optional().describe("Line delimiter"),
    updateServerSettings: booleanCoerce
      .optional()
      .default(false)
      .describe(
        "Automatically enable local_infile on the server if disabled (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege)",
      ),
  })
  .describe("Parallel table import using util.importTable()");

export const ShellImportTableInputSchema = z
  .object({
    inputPath: z.string().optional(),
    inputUrl: z.string().optional(),
    schema: z.unknown().optional(),
    table: z.unknown().optional(),
    threads: z.number().int().optional().default(4),
    skipRows: z.number().int().optional(),
    columns: z.array(z.string()).optional(),
    fieldsTerminatedBy: z.string().optional(),
    linesTerminatedBy: z.string().optional(),
    updateServerSettings: booleanCoerce.optional().default(false),
  })
  .transform((data) => ({
    ...data,
    schema:
      data.schema === undefined
        ? ""
        : String(data.schema as string | number | boolean),
    table:
      data.table === undefined
        ? ""
        : String(data.table as string | number | boolean),
  }))
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.table !== "", { message: "table must not be empty" });

export const ShellImportJSONInputSchemaBase = z
  .object({
    inputPath: z.string().optional().describe("JSON file path (absolute path)"),
    inputUrl: z.string().optional().describe("Alias for inputPath"),
    schema: z.string().optional().describe("Target schema (database) name"),
    table: z.string().optional().describe("Target table name (alias for collection)"),
    collection: z
      .string()
      .optional()
      .describe("Target collection or table name"),
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

export const ShellImportJSONInputSchema = z
  .object({
    inputPath: z.string().optional(),
    inputUrl: z.string().optional(),
    schema: z.unknown().optional(),
    table: z.unknown().optional(),
    collection: z.unknown().optional(),
    tableColumn: z.string().optional(),
    convertBsonTypes: booleanCoerce.optional().default(false),
  })
  .transform((data) => ({
    ...data,
    schema:
      data.schema === undefined
        ? ""
        : String(data.schema as string | number | boolean),
    collection:
      data.collection !== undefined
        ? String(data.collection as string | number | boolean)
        : data.table !== undefined
        ? String(data.table as string | number | boolean)
        : "",
  }))
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.collection !== "", {
    message: "collection must not be empty",
  });

// =============================================================================
// Backup Tools
// =============================================================================

export const ShellDumpInstanceInputSchema = z
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

// =============================================================================
// Restore Tools
// =============================================================================

export const ShellLoadDumpInputSchema = z
  .object({
    inputDir: z
      .string()
      .optional()
      .describe("Directory containing MySQL Shell dump"),
    inputUrl: z.string().optional().describe("Alias for inputDir"),
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

export const ShellRunScriptInputSchemaBase = z
  .object({
    script: z.string().optional().describe("Script content to execute"),
    language: z
      .enum(["js", "py", "sql", "javascript", "python"])
      .optional()
      .default("js")
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

export const ShellRunScriptInputSchema = z
  .object({
    script: z.unknown().optional(),
    language: z
      .enum(["js", "py", "sql", "javascript", "python"])
      .optional()
      .default("js"),
    timeout: z.number().int().optional().default(60000),
  })
  .transform((data) => ({
    script:
      data.script === undefined
        ? ""
        : String(data.script as string | number | boolean),
    language: data.language,
    timeout: data.timeout,
  }))
  .refine((data) => data.script !== "", {
    message: "Script content cannot be empty",
  });

// =============================================================================
// Tool Output Schemas
// =============================================================================

export const ShellVersionOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    version: z.string(),
    binPath: z.string().optional(),
    rawOutput: z.string(),
  }).loose().optional(),
});

export const ShellCheckUpgradeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    targetVersion: z.string(),
    serverVersion: z.string().optional(),
    errorCount: z.number(),
    warningCount: z.number(),
    noticeCount: z.number(),
    checksPerformed: z.number().optional(),
    upgradeCheck: z.unknown(),
  }).loose().optional(),
});

export const ShellExportTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    schema: z.string(),
    table: z.string(),
    outputPath: z.string(),
    format: z.string().optional(),
    result: z.unknown(),
  }).loose().optional(),
});

export const ShellImportTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    inputPath: z.string(),
    schema: z.string(),
    table: z.string(),
    localInfileEnabled: z.boolean().optional(),
    result: z.unknown(),
  }).loose().optional(),
});

export const ShellImportJSONOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    inputPath: z.string(),
    schema: z.string(),
    collection: z.string(),
    protocol: z.string(),
    result: z.unknown(),
  }).loose().optional(),
});

export const ShellDumpInstanceOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    outputDir: z.string(),
    dryRun: z.boolean(),
    result: z.unknown(),
  }).loose().optional(),
});

export const ShellDumpSchemasOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    schemas: z.array(z.string()),
    outputDir: z.string(),
    dryRun: z.boolean(),
    ddlOnly: z.boolean(),
    result: z.unknown(),
  }).loose().optional(),
});

export const ShellDumpTablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    schema: z.string(),
    tables: z.array(z.string()),
    outputDir: z.string(),
    dryRun: z.boolean(),
    triggersExcluded: z.boolean().optional(),
    result: z.unknown(),
  }).loose().optional(),
});

export const ShellLoadDumpOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    inputDir: z.string(),
    dryRun: z.boolean(),
    localInfileEnabled: z.boolean().optional(),
    result: z.unknown().optional(),
    dryRunOutput: z.string().optional(),
  }).loose().optional(),
});

export const ShellRunScriptOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    language: z.string(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
  }).loose().optional(),
});
