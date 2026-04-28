import { z } from "zod";
import { preprocessAdminTableParams } from "./preprocess-utils.js";

// =============================================================================
// Admin Schemas
// =============================================================================

// --- OptimizeTable ---
export const OptimizeTableSchemaBase = z.object({
  tables: z.array(z.string()).optional().describe("Table names to optimize"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const OptimizeTableSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables ?? [],
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- AnalyzeTable ---
export const AnalyzeTableSchemaBase = z.object({
  tables: z.array(z.string()).optional().describe("Table names to analyze"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const AnalyzeTableSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables ?? [],
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- CheckTable ---
export const CheckTableSchemaBase = z.object({
  tables: z.array(z.string()).optional().describe("Table names to check"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  option: z.string().optional().describe("Check option"),
});

export const CheckTableSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      option: z
        .enum(["QUICK", "FAST", "MEDIUM", "EXTENDED", "CHANGED"])
        .optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables ?? [],
    option: data.option,
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- RepairTable ---
export const RepairTableSchemaBase = z.object({
  tables: z.array(z.string()).optional().describe("Table names to repair"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  quick: z
    .boolean()
    .optional()
    .default(false)
    .describe("Quick repair (MyISAM only)"),
});

export const RepairTableSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      quick: z.boolean().optional().default(false),
    }),
  )
  .transform((data) => ({
    tables: data.tables ?? [],
    quick: data.quick,
  }))
  .refine((data) => data.tables.length > 0, {
    message: "tables (or table/tableName/name alias) is required",
  });

// --- FlushTables ---
export const FlushTablesSchemaBase = z.object({
  tables: z
    .array(z.string())
    .optional()
    .describe("Specific tables to flush (empty for all)"),
  table: z.string().optional().describe("Single table name (alias for tables)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const FlushTablesSchema = z
  .preprocess(
    preprocessAdminTableParams,
    z.object({
      tables: z.array(z.string()).optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    tables: data.tables,
  }));

export const KillQuerySchemaBase = z.object({
  processId: z.any().optional().describe("Process ID to kill"),
  id: z.any().optional().describe("Alias for process ID to kill"),
  connection: z
    .boolean()
    .optional()
    .default(false)
    .describe("Kill connection instead of query"),
});

export const KillQuerySchema = z
  .object({
    processId: z.any().optional(),
    id: z.any().optional(),
    connection: z.boolean().optional().default(false),
  })
  .transform((data) => ({
    processId: data.processId ?? data.id,
    connection: data.connection,
  }))
  .refine(
    (data) =>
      data.processId !== undefined &&
      data.processId !== null &&
      !Number.isNaN(Number(data.processId)),
    { message: "processId (or id alias) is required and must be a valid number" },
  )
  .transform((data) => ({
    processId: Number(data.processId),
    connection: data.connection,
  }));

export const ShowProcesslistSchema = z.object({
  full: z.boolean().optional().default(false).describe("Show full query text"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(50)
    .describe(
      "Maximum number of processes to return (default: 50). Set higher to see all.",
    ),
});

export const ShowStatusSchema = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern"),
  global: z.boolean().optional().default(true).describe("Show global status"),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 30). Set higher to see all.",
    ),
});

export const ShowVariablesSchema = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern"),
  global: z
    .boolean()
    .optional()
    .default(true)
    .describe("Show global variables"),
  limit: z
    .number()
    .int()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 30). Set higher to see all.",
    ),
});
