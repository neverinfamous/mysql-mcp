import { z } from "zod";
import { booleanCoerce } from "./base.js";

export const ShellImportTableInputSchemaBase = z
  .object({
    inputPath: z
      .string()
      .optional()
      .describe("Input file path (absolute path)"),
    inputUrl: z.string().optional().describe("Alias for inputPath"),
    schema: z.string().optional().describe("Target schema (database) name"),
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

export const ShellImportTableInputSchema = z
  .object({
    inputPath: z.string().optional(),
    inputUrl: z.string().optional(),
    schema: z.unknown().optional(),
    table: z.unknown().optional(),
    tableName: z.unknown().optional(),
    name: z.unknown().optional(),
    threads: z.number().int().optional().default(4),
    skipRows: z.number().int().optional(),
    columns: z.array(z.string()).optional(),
    fieldsTerminatedBy: z.string().optional(),
    linesTerminatedBy: z.string().optional(),
    updateServerSettings: booleanCoerce.optional().default(false),
  })
  .transform((data) => {
    const rawTable = data.table ?? data.tableName ?? data.name;
    return {
      ...data,
      schema:
        typeof data.schema === "string"
          ? data.schema
          : typeof data.schema === "number" || typeof data.schema === "boolean"
            ? data.schema.toString()
            : "",
      table:
        typeof rawTable === "string"
          ? rawTable
          : typeof rawTable === "number" || typeof rawTable === "boolean"
            ? rawTable.toString()
            : "",
    };
  })
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.table !== "", { message: "table must not be empty" });

export const ShellImportJSONInputSchemaBase = z
  .object({
    inputPath: z.string().optional().describe("JSON file path (absolute path)"),
    inputUrl: z.string().optional().describe("Alias for inputPath"),
    schema: z.string().optional().describe("Target schema (database) name"),
    collection: z
      .string()
      .optional()
      .describe("Target collection or table name"),
    table: z.string().optional().describe("Alias for collection"),
    tableName: z.string().optional().describe("Alias for collection"),
    name: z.string().optional().describe("Alias for collection"),
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
    collection: z.unknown().optional(),
    table: z.unknown().optional(),
    tableName: z.unknown().optional(),
    name: z.unknown().optional(),
    tableColumn: z.string().optional(),
    convertBsonTypes: booleanCoerce.optional().default(false),
  })
  .transform((data) => {
    const rawCollection = data.collection ?? data.table ?? data.tableName ?? data.name;
    return {
      ...data,
      schema:
        typeof data.schema === "string"
          ? data.schema
          : typeof data.schema === "number" || typeof data.schema === "boolean"
            ? data.schema.toString()
            : "",
      collection:
        typeof rawCollection === "string"
          ? rawCollection
          : typeof rawCollection === "number" || typeof rawCollection === "boolean"
            ? rawCollection.toString()
            : "",
    };
  })
  .refine((data) => data.schema !== "", { message: "schema must not be empty" })
  .refine((data) => data.collection !== "", {
    message: "collection must not be empty",
  });
