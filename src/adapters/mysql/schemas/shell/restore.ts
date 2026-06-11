import { z } from "zod";
import { booleanCoerce } from "./base.js";

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
