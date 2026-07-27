import { z } from "zod";

export const DescriptiveStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  fieldName: z.string().optional().describe("Alias for column"),
  c: z.string().optional().describe("Alias for column"),
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
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column name"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  fieldName: z.string().optional().describe("Alias for column"),
  c: z.string().optional().describe("Alias for column"),
  percentiles: z.union([z.array(z.union([z.number(), z.string()])), z.string()]).optional().describe("Percentiles to calculate (array or comma-separated string)"),
  p: z.union([z.array(z.union([z.number(), z.string()])), z.string()]).optional().describe("Alias for percentiles"),
  pct: z.union([z.array(z.union([z.number(), z.string()])), z.string()]).optional().describe("Alias for percentiles"),
  percentile: z.union([z.array(z.union([z.number(), z.string()])), z.string()]).optional().describe("Alias for percentiles"),
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
    
    let p = obj["percentiles"] ?? obj["p"] ?? obj["pct"] ?? obj["percentile"];
    if (typeof p === "number") {
      p = [p];
    } else if (typeof p === "string") {
      p = p.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    }

    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"] ?? obj["tbl"] ?? obj["table_name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"] ?? obj["c"],
      percentiles: p,
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    percentiles: z
      .array(z.coerce.number().min(0).max(100))
      .min(1, "At least one valid percentile must be specified")
      .default([25, 50, 75, 90, 95, 99]),
    where: z.string().optional(),
  })
);

export const DistributionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column to analyze"),
  col: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  fieldName: z.string().optional().describe("Alias for column"),
  c: z.string().optional().describe("Alias for column"),
  buckets: z.number().optional().describe("Number of histogram buckets"),
  bucket: z.number().optional().describe("Alias for buckets"),
  num_buckets: z.number().optional().describe("Alias for buckets"),
  bucket_count: z.number().optional().describe("Alias for buckets"),
  numBuckets: z.number().optional().describe("Alias for buckets"),
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
      buckets: obj["buckets"] ?? obj["bucket"] ?? obj["num_buckets"] ?? obj["bucket_count"] ?? obj["numBuckets"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    buckets: z.coerce.number().int().min(1).max(100).default(10),
    where: z.string().optional(),
  })
);

export const TimeSeriesSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  valueColumn: z.string().optional().describe("Numeric column for values"),
  val: z.string().optional().describe("Alias for valueColumn"),
  value: z.string().optional().describe("Alias for valueColumn"),
  valColumn: z.string().optional().describe("Alias for valueColumn"),
  column: z.string().optional().describe("Alias for valueColumn"),
  col: z.string().optional().describe("Alias for valueColumn"),
  columnName: z.string().optional().describe("Alias for valueColumn"),
  timeColumn: z.string().optional().describe("Timestamp/datetime column"),
  time: z.string().optional().describe("Alias for timeColumn"),
  dateColumn: z.string().optional().describe("Alias for timeColumn"),
  timestamp: z.string().optional().describe("Alias for timeColumn"),
  date: z.string().optional().describe("Alias for timeColumn"),
  interval: z.string().optional().describe("Aggregation interval"),
  aggregation: z.string().optional().describe("Aggregation function"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z.number().optional().describe("Maximum number of data points"),
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
    limit: z.coerce.number().int().min(1).max(1000).default(50),
  })
);

export const SamplingSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  sampleSize: z.number().optional().describe("Number of rows to sample"),
  sample_size: z.number().optional().describe("Alias for sampleSize"),
  size: z.number().optional().describe("Alias for sampleSize"),
  limit: z.number().optional().describe("Alias for sampleSize"),
  columns: z
    .array(z.string())
    .optional()
    .describe("Columns to include (all if not specified)"),
  seed: z.number().optional().describe("Random seed for reproducibility"),
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
      sampleSize: obj["sampleSize"] ?? obj["sample_size"] ?? obj["size"] ?? obj["limit"],
      where: obj["where"] ?? obj["filter"] ?? obj["condition"] ?? obj["query"] ?? obj["sql"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    sampleSize: z.coerce.number().int().min(0).max(1000).default(10),
    columns: z.array(z.string()).optional(),
    seed: z.coerce.number().optional(),
    where: z.string().optional(),
  })
);
