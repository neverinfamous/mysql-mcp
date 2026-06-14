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
  processId: z.unknown().optional().describe("Process ID to kill"),
  id: z.unknown().optional().describe("Alias for process ID to kill"),
  connection: z
    .boolean()
    .optional()
    .default(false)
    .describe("Kill connection instead of query"),
});

export const KillQuerySchema = z
  .object({
    processId: z.unknown().optional(),
    id: z.unknown().optional(),
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
    {
      message: "processId (or id alias) is required and must be a valid number",
    },
  )
  .transform((data) => ({
    processId: Number(data.processId),
    connection: data.connection,
  }));

export const ShowProcesslistSchemaBase = z.object({
  full: z.boolean().optional().default(false).describe("Show full query text"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of processes to return (default: 50). Set higher to see all.",
    ),
});

export const ShowProcesslistSchema = z
  .object({
    full: z.boolean().optional().default(false),
    limit: z.unknown().optional(),
  })
  .transform((data) => ({
    full: data.full,
    limit: data.limit !== undefined ? Number(data.limit) : 50,
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

export const ShowStatusSchemaBase = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern"),
  global: z.boolean().optional().default(true).describe("Show global status"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 30). Set higher to see all.",
    ),
});

export const ShowStatusSchema = z
  .object({
    like: z.string().optional(),
    global: z.boolean().optional().default(true),
    limit: z.unknown().optional(),
  })
  .transform((data) => ({
    like: data.like,
    global: data.global,
    limit: data.limit !== undefined ? Number(data.limit) : 30,
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

export const ShowVariablesSchemaBase = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern"),
  global: z
    .boolean()
    .optional()
    .default(true)
    .describe("Show global variables"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 30). Set higher to see all.",
    ),
});

export const ShowVariablesSchema = z
  .object({
    like: z.string().optional(),
    global: z.boolean().optional().default(true),
    limit: z.unknown().optional(),
  })
  .transform((data) => ({
    like: data.like,
    global: data.global,
    limit: data.limit !== undefined ? Number(data.limit) : 30,
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

// --- ServerConfig ---
export const ServerConfigSchemaBase = z.object({
  action: z
    .enum(["get", "set"])
    .describe("Whether to get or set the configuration value"),
  setting: z
    .enum(["logLevel"])
    .optional()
    .describe("The setting to modify"),
  value: z
    .string()
    .optional()
    .describe("The new value for the setting (e.g., 'debug', 'info', 'warning')"),
});

export const ServerConfigSchema = ServerConfigSchemaBase.refine(
  (data) => {
    if (data.action === "set") {
      return data.setting !== undefined && data.value !== undefined;
    }
    return true;
  },
  { message: "setting and value are required for 'set' action" }
);

// =============================================================================
// Output Schemas
// =============================================================================

import { BaseOutputSchema } from "./output-schemas.js";

// --- maintenance.ts ---
export const OptimizeTableOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    results: z.array(z.record(z.string(), z.unknown())),
    rowCount: z.number()
  }).optional()
});

export const AnalyzeTableOutputSchema = OptimizeTableOutputSchema;
export const CheckTableOutputSchema = OptimizeTableOutputSchema;
export const RepairTableOutputSchema = OptimizeTableOutputSchema;

export const FlushTablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({}).optional()
});

export const KillQueryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    killed: z.number(),
    type: z.string()
  }).optional()
});

// --- monitoring.ts ---
export const ShowProcesslistOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    processes: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    limited: z.boolean().optional(),
    totalAvailable: z.number().optional()
  }).optional()
});

export const ShowStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    status: z.record(z.string(), z.unknown()),
    rowCount: z.number(),
    totalAvailable: z.number(),
    limited: z.boolean().optional()
  }).optional()
});

export const ShowVariablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    variables: z.record(z.string(), z.unknown()),
    rowCount: z.number(),
    totalAvailable: z.number(),
    limited: z.boolean().optional()
  }).optional()
});

export const InnodbStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    summary: z.record(z.string(), z.unknown()).optional(),
    status: z.string().optional(),
    truncated: z.boolean().optional()
  }).optional()
});

export const ReplicationStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    configured: z.boolean(),
    message: z.string().optional(),
    status: z.record(z.string(), z.unknown()).optional(),
    summary: z.boolean().optional()
  }).optional()
});

export const PoolStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    poolStats: z.record(z.string(), z.unknown())
  }).optional()
});

export const ServerHealthOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    serverHealth: z.record(z.string(), z.unknown())
  }).optional()
});

// --- audit-search.ts ---
export const AuditSearchOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    entries: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    totalCount: z.number()
  }).optional()
});

// --- audit-backup.ts ---
export const AuditListBackupsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    backups: z.array(z.record(z.string(), z.unknown())),
    total: z.number()
  }).optional()
});

export const AuditRestoreBackupOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    dryRun: z.boolean().optional(),
    sql: z.string().optional(),
    restoredFilename: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

export const AuditDiffBackupOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    snapshotDdl: z.string(),
    liveDdl: z.string(),
    metadata: z.record(z.string(), z.unknown())
  }).optional()
});

// --- insights.ts ---
export const AppendInsightOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    insightCount: z.number(),
    message: z.string()
  }).optional()
});

// --- server-config.ts ---
export const ServerConfigOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    config: z.record(z.string(), z.unknown()).optional(),
    message: z.string().optional()
  }).optional()
});
