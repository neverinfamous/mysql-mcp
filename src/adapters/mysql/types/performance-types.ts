import { z } from "zod";
import { preprocessTableParams, preprocessQueryOnlyParams } from "./preprocessors.js";

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
    .default("JSON")
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
        .default("JSON"),
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
export const SlowQuerySchema = z.object({
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Number of slow queries to return"),
  minTime: z.number().optional().describe("Minimum query time in seconds"),
});

// --- QueryStats (no table/query aliases — simple passthrough) ---
export const QueryStatsSchema = z.object({
  orderBy: z
    .enum(["total_time", "avg_time", "executions"])
    .optional()
    .default("total_time")
    .describe("Order results by metric"),
  limit: z
    .number()
    .optional()
    .default(10)
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
    .default(10)
    .describe("Maximum number of indexes to return"),
});

export const IndexUsageSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      limit: z.number().int().positive().optional().default(10),
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
  table: z.string().optional().describe("Table to analyze for missing indexes"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

// Transformed schema for handler parsing
export const IndexRecommendationSchema = z
  .preprocess(preprocessTableParams, IndexRecommendationSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

// --- ForceIndex ---

// Base schema for MCP visibility
export const ForceIndexSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  query: z.string().describe("Original query"),
  indexName: z.string().describe("Index name to force"),
});

// Transformed schema for handler parsing
export const ForceIndexSchema = z
  .preprocess(preprocessTableParams, ForceIndexSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    query: data.query,
    indexName: data.indexName,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName/name alias) is required",
  });

