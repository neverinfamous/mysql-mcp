import { z } from "zod";
import { preprocessJsonColumnParams } from "../../../schemas/preprocess-utils.js";

export const StatsRowNumberSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .unknown()
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .unknown()
    .optional()
    .describe("Number of rows to skip (default: 0)"),
});

export const StatsRowNumberSchema = z.preprocess(
  preprocessJsonColumnParams,
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    orderBy: z.string().min(1, "orderBy is required"),
    partitionBy: z.string().optional(),
    selectColumns: z.array(z.string()).optional(),
    where: z.string().optional(),
    limit: z.number().min(1).max(1000).default(10),
    offset: z.number().min(0).default(0),
  })
);

export const StatsRankSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  orderBy: z
    .string()
    .optional()
    .describe("Column(s) to order by (determines rank)"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .unknown()
    .optional()
    .describe("Columns to include in result"),
  method: z.unknown().optional().describe("Rank function type (default: rank)"),
  where: z.string().optional().describe("Filter condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .unknown()
    .optional()
    .describe("Number of rows to skip (default: 0)"),
});

export const StatsRankSchema = z.preprocess(
  preprocessJsonColumnParams,
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    orderBy: z.string().min(1, "orderBy is required"),
    partitionBy: z.string().optional(),
    selectColumns: z.array(z.string()).optional(),
    method: z.enum(["rank", "dense_rank", "percent_rank"]).default("rank"),
    where: z.string().optional(),
    limit: z.number().min(1).max(1000).default(10),
    offset: z.number().min(0).default(0),
  })
);

export const StatsLagLeadSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column to get lag/lead value from"),
  col: z.string().optional().describe("Alias for column"),
  valueColumn: z.string().optional().describe("Alias for column"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  direction: z
    .unknown()
    .optional()
    .describe("LAG (previous row) or LEAD (next row)"),
  offset: z
    .unknown()
    .optional()
    .describe("Number of rows to look back/ahead (default: 1)"),
  defaultValue: z
    .string()
    .optional()
    .describe("Default value if no row exists"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .unknown()
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  paginationOffset: z
    .unknown()
    .optional()
    .describe("Number of rows to skip (default: 0)"),
});

export const StatsLagLeadSchema = z.preprocess(
  preprocessJsonColumnParams,
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    orderBy: z.string().min(1, "orderBy is required"),
    direction: z.enum(["lag", "lead"]).default("lag"),
    offset: z.number().min(1).default(1),
    defaultValue: z.string().optional(),
    partitionBy: z.string().optional(),
    selectColumns: z.array(z.string()).optional(),
    where: z.string().optional(),
    limit: z.number().min(1).max(1000).default(10),
    paginationOffset: z.number().min(0).default(0),
  })
);

export const StatsRunningTotalSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column to sum"),
  col: z.string().optional().describe("Alias for column"),
  valueColumn: z.string().optional().describe("Alias for column"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  partitionBy: z
    .string()
    .optional()
    .describe("Reset running total for each partition"),
  selectColumns: z
    .unknown()
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .unknown()
    .optional()
    .describe("Number of rows to skip (default: 0)"),
});

export const StatsRunningTotalSchema = z.preprocess(
  preprocessJsonColumnParams,
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    orderBy: z.string().min(1, "orderBy is required"),
    partitionBy: z.string().optional(),
    selectColumns: z.array(z.string()).optional(),
    where: z.string().optional(),
    limit: z.number().min(1).max(1000).default(10),
    offset: z.number().min(0).default(0),
  })
);

export const StatsMovingAvgSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column to average"),
  col: z.string().optional().describe("Alias for column"),
  valueColumn: z.string().optional().describe("Alias for column"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  windowSize: z
    .unknown()
    .optional()
    .describe("Number of rows in the moving window"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .unknown()
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .unknown()
    .optional()
    .describe("Number of rows to skip (default: 0)"),
});

export const StatsMovingAvgSchema = z.preprocess(
  preprocessJsonColumnParams,
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    orderBy: z.string().min(1, "orderBy is required"),
    windowSize: z.number().min(1).default(3),
    partitionBy: z.string().optional(),
    selectColumns: z.array(z.string()).optional(),
    where: z.string().optional(),
    limit: z.number().min(1).max(1000).default(10),
    offset: z.number().min(0).default(0),
  })
);

export const StatsNtileSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  buckets: z
    .unknown()
    .optional()
    .describe("Number of buckets (e.g., 4 for quartiles)"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z
    .unknown()
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .unknown()
    .optional()
    .describe("Number of rows to skip (default: 0)"),
});

export const StatsNtileSchema = z.preprocess(
  preprocessJsonColumnParams,
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    orderBy: z.string().min(1, "orderBy is required"),
    buckets: z.number().min(1).default(4),
    partitionBy: z.string().optional(),
    selectColumns: z.array(z.string()).optional(),
    where: z.string().optional(),
    limit: z.number().min(1).max(1000).default(10),
    offset: z.number().min(0).default(0),
  })
);
