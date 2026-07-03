import { z } from "zod";
import { booleanCoerce } from "./base.js";

export const ShellLoadDumpInputSchemaBase = z
  .object({
    inputDir: z
      .string()
      .optional()
      .describe("Directory containing MySQL Shell dump"),
    inputUrl: z.string().optional().describe("Alias for inputDir"),
    dumpDir: z.string().optional().describe("Alias for inputDir"),
    url: z.string().optional().describe("Alias for inputDir"),
    path: z.string().optional().describe("Alias for inputDir"),
    file: z.string().optional().describe("Alias for inputDir"),
    filepath: z.string().optional().describe("Alias for inputDir"),
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
    includeTable: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for includeTables"),
    excludeTables: z.array(z.string()).optional().describe("Tables to exclude"),
    excludeTable: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for excludeTables"),
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

export const ShellLoadDumpInputSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") return val;
    const obj = val as { inputDir?: unknown; inputUrl?: unknown; dumpDir?: unknown; url?: unknown; path?: unknown; file?: unknown; filepath?: unknown; includeTables?: unknown; includeTable?: unknown; excludeTables?: unknown; excludeTable?: unknown };
    
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
      inputDir: obj.inputDir ?? obj.inputUrl ?? obj.dumpDir ?? obj.url ?? obj.path ?? obj.file ?? obj.filepath,
      includeTables: includeTablesArray,
      excludeTables: excludeTablesArray,
    };
  },
  ShellLoadDumpInputSchemaBase
);
