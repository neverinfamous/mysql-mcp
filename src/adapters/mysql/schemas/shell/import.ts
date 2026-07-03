import { z } from "zod";
import { booleanCoerce } from "./base.js";

export const ShellImportTableInputSchemaBase = z
  .object({
    inputPath: z
      .string()
      .optional()
      .describe("Input file path (absolute path)"),
    inputUrl: z.string().optional().describe("Alias for inputPath"),
    path: z.string().optional().describe("Alias for inputPath"),
    file: z.string().optional().describe("Alias for inputPath"),
    filepath: z.string().optional().describe("Alias for inputPath"),
    url: z.string().optional().describe("Alias for inputPath"),
    schema: z.string().optional().describe("Target schema (database) name"),
    database: z.string().optional().describe("Alias for schema"),
    table: z.string().optional().describe("Target table name"),
    tableName: z.string().optional().describe("Alias for table"),
    name: z.string().optional().describe("Alias for table"),
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

export const ShellImportTableInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { schema?: unknown; database?: unknown; table?: unknown; tableName?: unknown; name?: unknown; inputPath?: unknown; inputUrl?: unknown; path?: unknown; file?: unknown; filepath?: unknown; url?: unknown };
    const rawSchema = obj.schema ?? obj.database;
    const rawTable = obj.table ?? obj.tableName ?? obj.name;
    return {
      ...obj,
      schema:
        typeof rawSchema === "number" || typeof rawSchema === "boolean"
          ? String(rawSchema)
          : rawSchema,
      table:
        typeof rawTable === "number" || typeof rawTable === "boolean"
          ? String(rawTable)
          : rawTable,
      inputPath: obj.inputPath ?? obj.inputUrl ?? obj.path ?? obj.file ?? obj.filepath ?? obj.url,
    };
  },
  ShellImportTableInputSchemaBase
).refine((data) => data.schema !== "", { message: "schema must not be empty" })
 .refine((data) => data.table != null && data.table !== "", { message: "table is required" });

export const ShellImportJSONInputSchemaBase = z
  .object({
    inputPath: z.string().optional().describe("JSON file path (absolute path)"),
    inputUrl: z.string().optional().describe("Alias for inputPath"),
    path: z.string().optional().describe("Alias for inputPath"),
    file: z.string().optional().describe("Alias for inputPath"),
    filepath: z.string().optional().describe("Alias for inputPath"),
    url: z.string().optional().describe("Alias for inputPath"),
    schema: z.string().optional().describe("Target schema (database) name"),
    database: z.string().optional().describe("Alias for schema"),
    collection: z
      .string()
      .optional()
      .describe("Target collection or table name"),
    table: z.string().optional().describe("Alias for collection"),
    tableName: z.string().optional().describe("Alias for collection"),
    name: z.string().optional().describe("Alias for collection"),
    coll: z.string().optional().describe("Alias for collection"),
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

export const ShellImportJSONInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { schema?: unknown; database?: unknown; collection?: unknown; table?: unknown; tableName?: unknown; name?: unknown; coll?: unknown; inputPath?: unknown; inputUrl?: unknown; path?: unknown; file?: unknown; filepath?: unknown; url?: unknown };
    const rawSchema = obj.schema ?? obj.database;
    const rawCollection = obj.collection ?? obj.table ?? obj.tableName ?? obj.name ?? obj.coll;
    return {
      ...obj,
      schema:
        typeof rawSchema === "number" || typeof rawSchema === "boolean"
          ? String(rawSchema)
          : rawSchema,
      collection:
        typeof rawCollection === "number" || typeof rawCollection === "boolean"
          ? String(rawCollection)
          : rawCollection,
      inputPath: obj.inputPath ?? obj.inputUrl ?? obj.path ?? obj.file ?? obj.filepath ?? obj.url,
    };
  },
  ShellImportJSONInputSchemaBase
).refine((data) => data.schema !== "", { message: "schema must not be empty" })
 .refine((data) => data.collection != null && data.collection !== "", { message: "collection is required" });
