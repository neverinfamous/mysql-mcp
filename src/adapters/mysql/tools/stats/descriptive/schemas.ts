import { z } from "zod";

export const DescriptiveStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column name"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const DescriptiveStatsSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"] ?? obj["tbl"] ?? obj["table_name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"] ?? obj["c"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    where: z.string().optional(),
  })
);

export const PercentilesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column name"),
  percentiles: z.unknown().optional().describe("Percentiles to calculate"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const PercentilesSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"] ?? obj["tbl"] ?? obj["table_name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"] ?? obj["c"],
      percentiles: obj["percentiles"] ?? obj["p"] ?? obj["pct"] ?? obj["percentile"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    percentiles: z
      .array(z.number().min(0).max(100))
      .default([25, 50, 75, 90, 95, 99]),
    where: z.string().optional(),
  })
);

export const DistributionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column to analyze"),
  buckets: z.unknown().optional().describe("Number of histogram buckets"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const DistributionSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"] ?? obj["tbl"] ?? obj["table_name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"] ?? obj["c"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    buckets: z.number().max(100).default(10),
    where: z.string().optional(),
  })
);

export const TimeSeriesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  valueColumn: z.string().optional().describe("Numeric column for values"),
  timeColumn: z.string().optional().describe("Timestamp/datetime column"),
  interval: z.string().optional().describe("Aggregation interval"),
  aggregation: z.string().optional().describe("Aggregation function"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z.unknown().optional().describe("Maximum number of data points"),
});

export const TimeSeriesSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"] ?? obj["tbl"] ?? obj["table_name"],
      valueColumn: obj["valueColumn"] ?? obj["val"] ?? obj["value"] ?? obj["valColumn"] ?? obj["column"] ?? obj["col"] ?? obj["columnName"],
      timeColumn: obj["timeColumn"] ?? obj["time"] ?? obj["dateColumn"] ?? obj["timestamp"] ?? obj["date"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    valueColumn: z.string().min(1, "valueColumn is required"),
    timeColumn: z.string().min(1, "timeColumn is required"),
    interval: z.string().default("day"),
    aggregation: z.string().default("avg"),
    where: z.string().optional(),
    limit: z.number().default(100),
  })
);

export const SamplingSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  sampleSize: z.unknown().optional().describe("Number of rows to sample"),
  columns: z
    .unknown()
    .optional()
    .describe("Columns to include (all if not specified)"),
  seed: z.unknown().optional().describe("Random seed for reproducibility"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const SamplingSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"] ?? obj["tbl"] ?? obj["table_name"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    sampleSize: z.number().default(10),
    columns: z.array(z.string()).optional(),
    seed: z.number().optional(),
    where: z.string().optional(),
  })
);
