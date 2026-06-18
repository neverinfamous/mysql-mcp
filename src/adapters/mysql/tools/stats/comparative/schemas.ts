import { z } from "zod";

export const CorrelationSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column1: z.string().optional().describe("First numeric column"),
  column2: z.string().optional().describe("Second numeric column"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

export const CorrelationSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column1: z.string().min(1, "column1 is required"),
    column2: z.string().min(1, "column2 is required"),
    where: z.string().optional(),
  })
);

export const RegressionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  xColumn: z.string().optional().describe("Independent variable column"),
  yColumn: z.string().optional().describe("Dependent variable column"),
  where: z.string().optional().describe("Optional WHERE clause condition"),
});

export const RegressionSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    xColumn: z.string().min(1, "xColumn is required"),
    yColumn: z.string().min(1, "yColumn is required"),
    where: z.string().optional(),
  })
);

export const HistogramSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Column for histogram"),
  buckets: z
    .unknown()
    .optional()
    .describe("Number of histogram buckets (max 1024)"),
  update: z
    .unknown()
    .optional()
    .describe("Whether to create/update the histogram"),
});

export const HistogramSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
      column: obj["column"] ?? obj["col"],
    };
  },
  z.object({
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    buckets: z.number().min(1).default(16),
    update: z.boolean().default(false),
  })
);
