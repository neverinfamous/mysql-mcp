import { z } from "zod";
import {
  preprocessTableParams,
  preprocessQueryOnlyParams,
} from "./preprocess-utils.js";

// =============================================================================
// Performance Schemas
// =============================================================================

// --- Explain ---
export const ExplainSchemaBase = z.object({
  query: z.string().optional().describe("SQL query to explain"),
  sql: z.string().optional().describe("Alias for query"),
  format: z
    .enum(["TRADITIONAL", "JSON", "TREE"])
    .optional()
    .default("TREE")
    .describe("Output format"),
});

export const ExplainSchema = z
  .preprocess(
    preprocessQueryOnlyParams,
    z.object({
      query: z.string().optional(),
      sql: z.string().optional(),
      format: z
        .enum(["TRADITIONAL", "JSON", "TREE"])
        .optional()
        .default("TREE"),
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    format: data.format,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

// --- ExplainAnalyze ---
export const ExplainAnalyzeSchemaBase = z.object({
  query: z.string().optional().describe("SQL query to analyze"),
  sql: z.string().optional().describe("Alias for query"),
  format: z
    .enum(["TREE"])
    .optional()
    .default("TREE")
    .describe("Output format"),
});

export const ExplainAnalyzeSchema = z
  .preprocess(
    preprocessQueryOnlyParams,
    z.object({
      query: z.string().optional(),
      sql: z.string().optional(),
      format: z.enum(["TREE"]).optional().default("TREE"),
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    format: data.format,
  }))
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  });

// --- SlowQuery (no table/query aliases — simple passthrough) ---
export const SlowQuerySchemaBase = z.object({
  limit: z.number().optional().describe("Number of slow queries to return"),
  minTime: z.number().optional().describe("Minimum query time in seconds"),
});

export const SlowQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(3)
    .describe("Number of slow queries to return"),
  minTime: z.coerce
    .number()
    .optional()
    .describe("Minimum query time in seconds"),
});

// --- QueryStats (no table/query aliases — simple passthrough) ---
export const QueryStatsSchemaBase = z.object({
  orderBy: z.enum(["total_time", "avg_time", "executions"]).optional().describe("Order results by metric"),
  limit: z.number().optional().describe("Maximum number of queries to return"),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server query stats. Use explain or explainAnalyze instead."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server query stats. Use explain or explainAnalyze instead."),
});

export const QueryStatsSchema = z.object({
  orderBy: z
    .enum(["total_time", "avg_time", "executions"])
    .optional()
    .default("total_time")
    .describe("Order results by metric"),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(3)
    .describe("Maximum number of queries to return"),
  query: z.string().optional(),
  sql: z.string().optional(),
}).refine((data) => !data.query && !data.sql, {
  message: "Anti-Hallucination Hint: mysql_query_stats returns overall server stats. It does NOT accept a specific query or sql string. Use explain or explainAnalyze to analyze a specific query.",
});

// --- IndexUsage ---
export const IndexUsageSchemaBase = z.object({
  table: z.string().optional().describe("Filter by table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  limit: z.number().optional().describe("Maximum number of indexes to return"),
});

export const IndexUsageSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      limit: z.coerce.number().int().positive().optional().default(5),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- BufferPoolStats ---
export const BufferPoolStatsSchemaBase = z.object({});

export const BufferPoolStatsSchema = z.preprocess(
  () => ({}),
  z.object({})
);

// --- ThreadStats ---
export const ThreadStatsSchemaBase = z.object({
  limit: z.number().optional().describe("Maximum number of threads to return (default: 5)"),
});

export const ThreadStatsSchema = z.object({
  limit: z.coerce.number().int().positive().optional().default(5),
});

// --- TableStats ---
export const TableStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const TableStatsSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- IndexRecommendation ---

// Base schema for MCP visibility
export const IndexRecommendationSchemaBase = z.object({
  table: z.string().optional().describe("Table to analyze (analyzes all tables if omitted)"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  queries: z.array(z.string()).optional()
    .describe("SQL queries to analyze with EXPLAIN for composite index recommendations"),
  includeRedundant: z.boolean().optional()
    .describe("Detect redundant/duplicate indexes (default: true)"),
  includeUnindexed: z.boolean().optional()
    .describe("Flag large tables without secondary indexes (default: true)"),
});

// Transformed schema for handler parsing
export const IndexRecommendationSchema = z
  .preprocess(preprocessTableParams, IndexRecommendationSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name,
    queries: data.queries,
    includeRedundant: data.includeRedundant,
    includeUnindexed: data.includeUnindexed,
  }))
  .refine(
    (data) => {
      if (data.queries) {
        return data.queries.every((q) => /^\s*SELECT/i.test(q));
      }
      return true;
    },
    { message: "Only SELECT queries are supported for EXPLAIN analysis" }
  )
  .refine(
    (data) => !data.queries || data.queries.length <= 20,
    { message: "Maximum of 20 queries can be analyzed at once" }
  );

// --- ForceIndex ---

// Base schema for MCP visibility
export const ForceIndexSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  query: z.string().optional().describe("Original query"),
  sql: z.string().optional().describe("Alias for query"),
  indexName: z.string().optional().describe("Index name to force"),
  index: z.string().optional().describe("Alias for index name"),
});

// Transformed schema for handler parsing
export const ForceIndexSchema = z
  .preprocess(
    (data: unknown) => {
      const newData =
        typeof data === "string"
          ? { table: data }
          : typeof data === "object" && data !== null
            ? { ...data }
            : {};
      return preprocessTableParams(newData);
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      indexName: z.string().optional(),
      index: z.string().optional(),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    query: data.query ?? data.sql ?? "",
    indexName: data.indexName ?? data.index ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  })
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  })
  .refine((data) => data.indexName !== "", {
    message: "indexName (or index alias) is required",
  });

// --- Anomaly Detection ---

export const DetectQueryAnomaliesSchemaBase = z.object({
  threshold: z
    .number()
    .optional()
    .describe("Max/Avg variance multiplier threshold (default: 10.0)"),
  stdDevThreshold: z.number().optional().describe("Alias for threshold"),
  minCalls: z
    .number()
    .optional()
    .describe("Minimum call count to filter noise (default: 50)"),
  minExecutions: z.number().optional().describe("Alias for minCalls"),
});

export const DetectQueryAnomaliesSchema = z
  .preprocess(
    (data: unknown) => {
      if (typeof data !== "object" || data === null) return data;
      const record = data as Record<string, unknown>;
      return {
        ...record,
        threshold: record["threshold"] ?? record["stdDevThreshold"],
        minCalls: record["minCalls"] ?? record["minExecutions"],
      };
    },
    z.object({
      threshold: z.coerce.number().min(2).max(10000).optional().default(10.0),
      stdDevThreshold: z.coerce.number().optional(),
      minCalls: z.coerce.number().int().min(1).max(100000).optional().default(50),
      minExecutions: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    threshold: data.threshold ?? data.stdDevThreshold ?? 10.0,
    minCalls: data.minCalls ?? data.minExecutions ?? 50,
  }));

export const DetectBloatRiskSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Filter to a specific database schema"),
  table: z
    .string()
    .optional()
    .describe("Filter to a specific table"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  minSizeMb: z
    .number()
    .optional()
    .describe("Minimum table size in MB to include (default: 10)"),
  minSize: z.number().optional().describe("Alias for minSizeMb"),
});

export const DetectBloatRiskSchema = z
  .preprocess(
    (data: unknown) => {
      const processed = preprocessTableParams(data);
      if (typeof processed !== "object" || processed === null) return processed;
      const record = processed as Record<string, unknown>;
      return {
        ...record,
        minSizeMb: record["minSizeMb"] ?? record["minSize"],
      };
    },
    z.object({
      schema: z.string().optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      minSizeMb: z.coerce.number().min(0).optional().default(10),
      minSize: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    schema: data.schema,
    table: data.table ?? data.tableName ?? data.name,
    minSizeMb: data.minSizeMb,
  }));

export const DetectConnectionSpikeSchemaBase = z.object({
  warningPercent: z
    .number()
    .optional()
    .describe("Percentage threshold for flagging concentration (default: 70)"),
  windowMinutes: z
    .number()
    .optional()
    .describe("Idle time window in minutes to flag connections (default: 5)"),
  thresholdPercent: z.number().optional().describe("Alias for warningPercent"),
  threshold: z.number().optional().describe("Alias for warningPercent"),
});

export const DetectConnectionSpikeSchema = z
  .preprocess(
    (data: unknown) => {
      if (typeof data !== "object" || data === null) return data;
      const record = data as Record<string, unknown>;
      return {
        ...record,
        warningPercent: record["warningPercent"] ?? record["thresholdPercent"] ?? record["threshold"],
      };
    },
    z.object({
      warningPercent: z.coerce.number().min(0).max(100).optional().default(70),
      windowMinutes: z.coerce.number().int().min(1).max(1440).optional().default(5),
      thresholdPercent: z.coerce.number().optional(),
      threshold: z.coerce.number().optional(),
    }),
  )
  .transform((data) => ({
    warningPercent: data.warningPercent,
    windowMinutes: data.windowMinutes,
  }));

// =============================================================================
// Output Schemas
// =============================================================================

import { BaseOutputSchema } from "./output-schemas.js";

// --- analysis.ts ---
export const ExplainOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    plan: z.unknown()
  }).optional()
});

export const ExplainAnalyzeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    analysis: z.array(z.record(z.string(), z.unknown()))
  }).optional()
});

export const SlowQueryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    slowQueries: z.array(z.record(z.string(), z.unknown()))
  }).optional()
});

export const QueryStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    queries: z.array(z.record(z.string(), z.unknown()))
  }).optional()
});

export const IndexUsageOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    indexUsage: z.array(z.record(z.string(), z.unknown()))
  }).optional()
});

export const TableStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    stats: z.record(z.string(), z.unknown())
  }).optional()
});

export const BufferPoolStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    bufferPoolStats: z.array(z.record(z.string(), z.unknown()))
  }).optional()
});

export const ThreadStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    threads: z.array(z.record(z.string(), z.unknown()))
  }).optional()
});

// --- anomaly-detection.ts ---
export const DetectQueryAnomaliesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    anomalies: z.array(z.record(z.string(), z.unknown())),
    riskLevel: z.string(),
    totalAnalyzed: z.number(),
    anomalyCount: z.number(),
    summary: z.string()
  }).optional()
});

export const DetectBloatRiskOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    tables: z.array(z.record(z.string(), z.unknown())),
    highRiskCount: z.number(),
    totalAnalyzed: z.number(),
    summary: z.string()
  }).optional()
});

// --- connection-analysis.ts ---
export const DetectConnectionSpikeOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    totalConnections: z.number(),
    maxConnections: z.number(),
    usagePercent: z.number(),
    byState: z.array(z.record(z.string(), z.unknown())),
    concentrations: z.array(z.record(z.string(), z.unknown())),
    warnings: z.array(z.string()),
    riskLevel: z.string(),
    summary: z.string()
  }).optional()
});

// --- index-audit.ts ---
export const IndexRecommendationOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    table: z.string().optional(),
    existingIndexes: z.array(z.record(z.string(), z.unknown())),
    findings: z.array(z.record(z.string(), z.unknown())),
    summary: z.record(z.string(), z.number()),
    recommendations: z.array(z.record(z.string(), z.unknown()))
  }).optional()
});

// --- optimization.ts ---
export const QueryRewriteOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    originalQuery: z.string(),
    rewrittenQuery: z.string(),
    suggestions: z.array(z.string()),
    explainPlan: z.unknown()
  }).optional()
});

export const ForceIndexOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    originalQuery: z.string(),
    rewrittenQuery: z.string(),
    hint: z.string()
  }).optional()
});

export const OptimizerTraceOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    query: z.string(),
    decisions: z.array(z.record(z.string(), z.unknown())).optional(),
    trace: z.array(z.record(z.string(), z.unknown())).optional()
  }).optional()
});
