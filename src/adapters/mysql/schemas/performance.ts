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
    .enum(["JSON", "TREE"])
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
      format: z.enum(["JSON", "TREE"]).optional().default("TREE"),
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
  limit: z.unknown().optional().describe("Number of slow queries to return"),
  minTime: z.unknown().optional().describe("Minimum query time in seconds"),
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
  orderBy: z.unknown().optional().describe("Order results by metric"),
  limit: z.unknown().optional().describe("Maximum number of queries to return"),
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
});

// --- IndexUsage ---
export const IndexUsageSchemaBase = z.object({
  table: z.string().optional().describe("Filter by table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .default(5)
    .describe("Maximum number of indexes to return"),
});

export const IndexUsageSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      limit: z.coerce.number().int().positive().optional().default(3),
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name,
    limit: data.limit,
  }));

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
    explainPlan: z.unknown(),
    explainError: z.string().optional()
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
