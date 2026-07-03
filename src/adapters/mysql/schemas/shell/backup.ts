import { z } from "zod";
import { booleanCoerce } from "./base.js";

export const ShellDumpInstanceInputSchemaBase = z
  .object({
    outputDir: z
      .string()
      .optional()
      .describe("Output directory for dump (must be empty or non-existent)"),
    outputUrl: z.string().optional().describe("Alias for outputDir"),
    url: z.string().optional().describe("Alias for outputDir"),
    path: z.string().optional().describe("Alias for outputDir"),
    dir: z.string().optional().describe("Alias for outputDir"),
    directory: z.string().optional().describe("Alias for outputDir"),
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

export const ShellDumpInstanceInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { outputDir?: unknown; outputUrl?: unknown; url?: unknown; path?: unknown; dir?: unknown; directory?: unknown };
    return {
      ...obj,
      outputDir: obj.outputDir ?? obj.outputUrl ?? obj.url ?? obj.path ?? obj.dir ?? obj.directory,
    };
  },
  ShellDumpInstanceInputSchemaBase
);

export const ShellDumpSchemasInputSchemaBase = z
  .object({
    schemas: z.union([z.string(), z.array(z.string())]).optional().describe("Schema names to dump"),
    schema: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for schemas"),
    schemaNames: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for schemas"),
    name: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for schemas"),
    database: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for schemas"),
    databases: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for schemas"),
    outputDir: z.string().optional().describe("Output directory for dump"),
    outputUrl: z.string().optional().describe("Alias for outputDir"),
    url: z.string().optional().describe("Alias for outputDir"),
    path: z.string().optional().describe("Alias for outputDir"),
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
    includeTable: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for includeTables"),
    excludeTables: z
      .array(z.string())
      .optional()
      .describe("Tables to exclude (schema.table format)"),
    excludeTable: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for excludeTables"),
    ddlOnly: booleanCoerce
      .optional()
      .default(false)
      .describe(
        "Dump only DDL (schema structure) without data or metadata requiring extra privileges (events, triggers, routines)",
      ),
  })
  .describe("Dump selected schemas using util.dumpSchemas()");

export const ShellDumpSchemasInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { schemas?: unknown; schema?: unknown; schemaNames?: unknown; name?: unknown; database?: unknown; databases?: unknown; outputDir?: unknown; outputUrl?: unknown; url?: unknown; path?: unknown; includeTables?: unknown; includeTable?: unknown; excludeTables?: unknown; excludeTable?: unknown };
    const rawSchemas = obj.schemas ?? obj.schema ?? obj.schemaNames ?? obj.name ?? obj.database ?? obj.databases;
    const schemasArray = Array.isArray(rawSchemas) 
      ? rawSchemas.map(String) 
      : typeof rawSchemas === "string" 
        ? [rawSchemas] 
        : undefined;

    const rawIncludeTables = obj.includeTables ?? obj.includeTable;
    const includeTablesArray = Array.isArray(rawIncludeTables) 
      ? rawIncludeTables.map(String) 
      : typeof rawIncludeTables === "string" 
        ? [rawIncludeTables] 
        : undefined;

    const rawExcludeTables = obj.excludeTables ?? obj.excludeTable;
    const excludeTablesArray = Array.isArray(rawExcludeTables) 
      ? rawExcludeTables.map(String) 
      : typeof rawExcludeTables === "string" 
        ? [rawExcludeTables] 
        : undefined;

    return {
      ...obj,
      schemas: schemasArray,
      outputDir: obj.outputDir ?? obj.outputUrl ?? obj.url ?? obj.path,
      includeTables: includeTablesArray,
      excludeTables: excludeTablesArray,
    };
  },
  ShellDumpSchemasInputSchemaBase
)
  .transform((data) => ({ ...data, schemas: data.schemas ?? [] }))
  .refine((data) => data.schemas.length > 0, {
    message: "At least one schema name is required",
  });

export const ShellDumpTablesInputSchemaBase = z
  .object({
    schema: z.string().optional().describe("Schema containing tables"),
    schemaName: z.string().optional().describe("Alias for schema"),
    database: z.string().optional().describe("Alias for schema"),
    tables: z.array(z.string()).optional().describe("Table names to dump"),
    tableNames: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for tables"),
    table: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for tables"),
    tableName: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for tables"),
    name: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for tables"),
    outputDir: z.string().optional().describe("Output directory for dump"),
    outputUrl: z.string().optional().describe("Alias for outputDir"),
    url: z.string().optional().describe("Alias for outputDir"),
    path: z.string().optional().describe("Alias for outputDir"),
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

export const ShellDumpTablesInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { schema?: unknown; schemaName?: unknown; database?: unknown; tables?: unknown; tableNames?: unknown; table?: unknown; tableName?: unknown; name?: unknown; outputDir?: unknown; outputUrl?: unknown; url?: unknown; path?: unknown; where?: unknown };
    const rawTables = obj.tables ?? obj.tableNames ?? obj.table ?? obj.tableName ?? obj.name;
    const tablesArray = Array.isArray(rawTables) 
      ? rawTables.map(String) 
      : typeof rawTables === "string" 
        ? [rawTables] 
        : undefined;
    
    let whereClause = obj.where;
    if (typeof whereClause === "string" && tablesArray !== undefined && tablesArray.length > 0) {
      const newWhere: Record<string, unknown> = {};
      for (const t of tablesArray) {
        newWhere[t] = whereClause;
      }
      whereClause = newWhere;
    }

    const rawSchema = obj.schema ?? obj.schemaName ?? obj.database;

    return {
      ...obj,
      schema:
        typeof rawSchema === "string"
          ? rawSchema
          : typeof rawSchema === "number" || typeof rawSchema === "boolean"
            ? String(rawSchema)
            : "",
      tables: tablesArray,
      outputDir: obj.outputDir ?? obj.outputUrl ?? obj.url ?? obj.path,
      where: whereClause,
    };
  },
  ShellDumpTablesInputSchemaBase
)
  .transform((data) => ({ ...data, tables: data.tables ?? [] }))
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.tables.length > 0, {
    message: "At least one table name is required",
  });
