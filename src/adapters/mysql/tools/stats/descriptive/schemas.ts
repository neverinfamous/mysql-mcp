import { z } from "zod";

export const DescriptiveStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Numeric column name"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

export const DescriptiveStatsSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  where: z.string().optional(),
});

export const PercentilesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Numeric column name"),
  percentiles: z.unknown().optional().describe("Percentiles to calculate"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

export const PercentilesSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  percentiles: z
    .array(z.number().min(0).max(100))
    .default([25, 50, 75, 90, 95, 99]),
  where: z.string().optional(),
});

export const DistributionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Column to analyze"),
  buckets: z.unknown().optional().describe("Number of histogram buckets"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

export const DistributionSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  buckets: z.number().max(100).default(10),
  where: z.string().optional(),
});

export const TimeSeriesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  valueColumn: z.string().optional().describe("Numeric column for values"),
  timeColumn: z.string().optional().describe("Timestamp/datetime column"),
  interval: z.string().optional().describe("Aggregation interval"),
  aggregation: z.string().optional().describe("Aggregation function"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  limit: z.unknown().optional().describe("Maximum number of data points"),
});

export const TimeSeriesSchema = z.object({
  table: z.string().min(1, "table is required"),
  valueColumn: z.string().min(1, "valueColumn is required"),
  timeColumn: z.string().min(1, "timeColumn is required"),
  interval: z.string().default("day"),
  aggregation: z.string().default("avg"),
  where: z.string().optional(),
  limit: z.number().default(100),
});

export const SamplingSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  sampleSize: z.unknown().optional().describe("Number of rows to sample"),
  columns: z
    .unknown()
    .optional()
    .describe("Columns to include (all if not specified)"),
  seed: z.unknown().optional().describe("Random seed for reproducibility"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

export const SamplingSchema = z.object({
  table: z.string().min(1, "table is required"),
  sampleSize: z.number().default(10),
  columns: z.array(z.string()).optional(),
  seed: z.number().optional(),
  where: z.string().optional(),
});
