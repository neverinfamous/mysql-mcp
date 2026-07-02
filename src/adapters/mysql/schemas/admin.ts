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
  connectionId: z.unknown().optional().describe("Alias for process ID to kill"),
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
    connectionId: z.unknown().optional(),
    connection: z.boolean().optional().default(false),
  })
  .transform((data) => ({
    processId: data.processId ?? data.id ?? data.connectionId,
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
      "Maximum number of processes to return (default: 10). Set higher to see all.",
    ),
});

export const ShowProcesslistSchema = z
  .object({
    full: z.boolean().optional().default(false),
    limit: z.unknown().optional(),
  })
  .transform((data) => ({
    full: data.full,
    limit: data.limit !== undefined ? Number(data.limit) : 10,
  }))
  .refine(
    (data) =>
      data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
    { message: "limit must be a positive integer" },
  );

export const ShowStatusSchemaBase = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern (alias: pattern, search, filter)"),
  global: z.boolean().optional().default(true).describe("Show global status"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 10). Set higher to see all.",
    ),
});

export const ShowStatusSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = obj as Record<string, unknown>;
      return {
        ...data,
        like: data["like"] ?? data["pattern"] ?? data["search"] ?? data["filter"],
      };
    }
    return obj;
  },
  z
    .object({
      like: z.string().optional(),
      global: z.boolean().optional().default(true),
      limit: z.unknown().optional(),
    })
    .transform((data) => ({
      like: data.like,
      global: data.global,
      limit: data.limit !== undefined ? Number(data.limit) : 10,
    }))
    .refine(
      (data) =>
        data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
      { message: "limit must be a positive integer" },
    )
);

export const ShowVariablesSchemaBase = z.object({
  like: z.string().optional().describe("Filter variables by LIKE pattern (alias: pattern, search, filter)"),
  global: z
    .boolean()
    .optional()
    .default(true)
    .describe("Show global variables"),
  limit: z
    .unknown()
    .optional()
    .describe(
      "Maximum number of variables to return (default: 10). Set higher to see all.",
    ),
});

export const ShowVariablesSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = obj as Record<string, unknown>;
      return {
        ...data,
        like: data["like"] ?? data["pattern"] ?? data["search"] ?? data["filter"],
      };
    }
    return obj;
  },
  z
    .object({
      like: z.string().optional(),
      global: z.boolean().optional().default(true),
      limit: z.unknown().optional(),
    })
    .transform((data) => ({
      like: data.like,
      global: data.global,
      limit: data.limit !== undefined ? Number(data.limit) : 10,
    }))
    .refine(
      (data) =>
        data.limit === undefined || (!Number.isNaN(data.limit) && data.limit > 0),
      { message: "limit must be a positive integer" },
    )
);

export const InnodbStatusSchemaBase = z.object({
  summary: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Return parsed summary with key metrics. Defaults to true. Set to false for raw string output.",
    ),
});

export const InnodbStatusSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = { ...(obj as Record<string, unknown>) };
      if (typeof data["summary"] === "string") data["summary"] = data["summary"] === "true";
      return data;
    }
    return obj ?? {};
  },
  InnodbStatusSchemaBase
);

export const ReplicationStatusSchemaBase = z.object({
  summary: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Return key replication metrics only instead of full 50+ field output (recommended)",
    ),
});

export const ReplicationStatusSchema = z.preprocess(
  (obj: unknown) => {
    if (typeof obj === "object" && obj !== null) {
      const data = { ...(obj as Record<string, unknown>) };
      if (typeof data["summary"] === "string") data["summary"] = data["summary"] === "true";
      return data;
    }
    return obj ?? {};
  },
  ReplicationStatusSchemaBase
);

export const PoolStatsSchemaBase = z.object({});

export const PoolStatsSchema = z.preprocess(
  (obj: unknown) => obj ?? {},
  PoolStatsSchemaBase
);

export const ServerHealthSchemaBase = z.object({});

export const ServerHealthSchema = z.preprocess(
  (obj: unknown) => obj ?? {},
  ServerHealthSchemaBase
);


// --- ServerConfig ---
export const ServerConfigSchemaBase = z.object({
  action: z
    .enum(["get", "set"])
    .optional()
    .default("get")
    .describe("Whether to get or set the configuration value. Defaults to 'get'."),
  setting: z
    .enum(["logLevel"])
    .optional()
    .describe("The setting to modify"),
  key: z.enum(["logLevel"]).optional().describe("Alias for setting"),
  value: z
    .string()
    .optional()
    .describe("The new value for the setting (e.g., 'debug', 'info', 'warning')"),
  val: z.string().optional().describe("Alias for value"),
});

export const ServerConfigSchema = z.preprocess(
  (obj: unknown) => {
    if (obj === null || obj === undefined || typeof obj !== "object") return { action: "get" };
    const record = obj as Record<string, unknown>;
    const result = { ...record };
    
    if (result["action"] === undefined) {
      result["action"] = "get";
    }
    if (result["setting"] === undefined && result["key"] !== undefined) {
      result["setting"] = result["key"];
    }
    if (result["value"] === undefined && result["val"] !== undefined) {
      result["value"] = result["val"];
    }
    return result;
  },
  ServerConfigSchemaBase
).refine(
  (data) => {
    if (data.action === "set") {
      return data.setting !== undefined && data.value !== undefined;
    }
    return true;
  },
  { message: "setting and value are required for 'set' action" }
);

// --- AuditSearch ---
export const AuditSearchSchemaBase = z.object({
  search: z.string().optional().describe("Fuzzy text search across tool, category, error, and args"),
  query: z.string().optional().describe("Alias for search"),
  sql: z.string().optional().describe("Alias for search"),
  tool: z.string().optional().describe("Filter by exact tool name"),
  category: z.string().optional().describe("Filter by category (e.g. read, write, admin)"),
  success: z.boolean().optional().describe("Filter by success status"),
  requestId: z.string().optional().describe("Filter by exact request ID"),
  fromTimestamp: z.string().optional().describe("Filter by start timestamp (ISO 8601)"),
  toTimestamp: z.string().optional().describe("Filter by end timestamp (ISO 8601)"),
  limit: z.number().int().min(1).max(100).default(5).describe("Max results to return"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
});

export const AuditSearchSchema = z.preprocess((obj: unknown) => {
  if (obj === null || obj === undefined || typeof obj !== "object") return obj;
  const record = obj as Record<string, unknown>;
  const result = { ...record };
  if (result["search"] === undefined && (result["query"] !== undefined || result["sql"] !== undefined)) {
    result["search"] = result["query"] ?? result["sql"];
  }
  if (typeof result["limit"] === "string") {
    const num = Number(result["limit"]);
    if (!Number.isNaN(num)) result["limit"] = num;
  }
  if (typeof result["offset"] === "string") {
    const num = Number(result["offset"]);
    if (!Number.isNaN(num)) result["offset"] = num;
  }
  return result;
}, AuditSearchSchemaBase);

// --- AppendInsight ---
export const AppendInsightSchemaBase = z.object({
  insight: z
    .string()
    .optional()
    .describe(
      "Business insight text to record. Note: Pass insight, not text or message.",
    ),
  text: z.string().optional().describe("Alias for insight"),
  message: z.string().optional().describe("Alias for insight"),
});

export const AppendInsightSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        return {
          ...data,
          insight: data["insight"] ?? data["text"] ?? data["message"] ?? data["query"] ?? data["sql"] ?? data["name"] ?? data["table"],
        };
      }
      return obj;
    },
    z.object({
      insight: z.string().optional(),
    })
  )
  .transform((data) => ({
    insight: data.insight ?? "",
  }))
  .refine((data) => data.insight !== "", {
    message: "insight (or text/message alias) is required",
  });

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
export const AuditListBackupsSchemaBase = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe("Max backups to return"),
  target: z
    .string()
    .optional()
    .describe("Filter by exact target object name (e.g. users)"),
  name: z.string().optional().describe("Alias for target"),
  tableName: z.string().optional().describe("Alias for target"),
  table: z.string().optional().describe("Alias for target"),
});

export const AuditListBackupsSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        return {
          ...data,
          target: data["target"] ?? data["name"] ?? data["tableName"] ?? data["table"],
        };
      }
      return obj;
    },
    z.object({
      limit: z.number().int().min(1).max(100).default(10),
      target: z.string().optional(),
    })
  )
  .transform((data) => ({
    limit: data.limit,
    target: data.target,
  }));


export const AuditListBackupsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    backups: z.array(z.record(z.string(), z.unknown())),
    total: z.number()
  }).optional()
});

export const AuditRestoreBackupSchemaBase = z.object({
  filename: z.string().optional().describe("Snapshot filename to restore. Note: Pass filename, not table or target."),
  file: z.string().optional().describe("Alias for filename"),
  fileUrl: z.string().optional().describe("Alias for filename"),
  id: z.string().optional().describe("Alias for filename"),
  backupId: z.string().optional().describe("Alias for filename"),
  table: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  tableName: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  target: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  sql: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  query: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  includeData: z
    .boolean()
    .default(false)
    .describe("Execute INSERT data if present in snapshot"),
  dryRun: z
    .boolean()
    .default(false)
    .describe("Return the DDL/DML without executing it"),
});

export const AuditRestoreBackupSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        return {
          ...data,
          filename: data["filename"] ?? data["file"] ?? data["fileUrl"] ?? data["id"] ?? data["backupId"] ?? data["table"] ?? data["tableName"] ?? data["target"] ?? data["sql"] ?? data["query"],
        };
      }
      return obj;
    },
    z.object({
      filename: z.string().optional(),
      includeData: z.boolean().default(false),
      dryRun: z.boolean().default(false),
    })
  )
  .transform((data) => ({
    filename: data.filename ?? "",
    includeData: data.includeData,
    dryRun: data.dryRun,
  }))
  .refine((data) => data.filename !== "", {
    message: "filename (or file/fileUrl alias) is required",
  });


export const AuditRestoreBackupOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    dryRun: z.boolean().optional(),
    sql: z.string().optional(),
    restoredFilename: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

export const AuditDiffBackupSchemaBase = z.object({
  filename: z
    .string()
    .optional()
    .describe("Snapshot filename to compare against current schema. Note: Pass filename, not table or target."),
  file: z.string().optional().describe("Alias for filename"),
  fileUrl: z.string().optional().describe("Alias for filename"),
  id: z.string().optional().describe("Alias for filename"),
  backupId: z.string().optional().describe("Alias for filename"),
  table: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  tableName: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  target: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  sql: z.string().optional().describe("Alias for filename (anti-hallucination)"),
  query: z.string().optional().describe("Alias for filename (anti-hallucination)"),
});

export const AuditDiffBackupSchema = z
  .preprocess(
    (obj: unknown) => {
      if (typeof obj === "object" && obj !== null) {
        const data = obj as Record<string, unknown>;
        return {
          ...data,
          filename: data["filename"] ?? data["file"] ?? data["fileUrl"] ?? data["id"] ?? data["backupId"] ?? data["table"] ?? data["tableName"] ?? data["target"] ?? data["sql"] ?? data["query"],
        };
      }
      return obj;
    },
    z.object({
      filename: z.string().optional(),
    })
  )
  .transform((data) => ({
    filename: data.filename ?? "",
  }))
  .refine((data) => data.filename !== "", {
    message: "filename (or file/fileUrl alias) is required",
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
