import { z } from "zod";
import { preprocessJsonColumnParams } from "../../../schemas/preprocess-utils.js";

export const StatsRowNumberSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name (Required). Anti-Hallucination Hint: Do not pass a full SQL query here."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  orderBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to order by (Required)"),
  order_by: z.string().optional().describe("Alias for orderBy"),
  sort: z.string().optional().describe("Alias for orderBy"),
  sortBy: z.string().optional().describe("Alias for orderBy"),
  partitionBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to partition by"),
  partition_by: z.string().optional().describe("Alias for partitionBy"),
  groupBy: z.string().optional().describe("Alias for partitionBy"),
  group_by: z.string().optional().describe("Alias for partitionBy"),
  selectColumns: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition. Anti-Hallucination Hint: Pass only the condition (e.g. 'amount > 100'), NOT a full SELECT query."),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows to skip (default: 0)"),
  asColumn: z.string().optional().describe("Alias for the output column"),
  as_column: z.string().optional().describe("Alias for asColumn"),
  alias: z.string().optional().describe("Alias for asColumn"),
});

export const StatsRowNumberSchema = z.preprocess(
  (val: unknown) => {
    const v = preprocessJsonColumnParams(val) as Record<string, unknown>;
    
    // Coerce orderBy to string if array
    let ob = v["orderBy"] ?? v["order_by"] ?? v["sort"] ?? v["sortBy"];
    if (Array.isArray(ob)) ob = ob.join(", ");
    
    // Coerce partitionBy to string if array
    let pb = v["partitionBy"] ?? v["partition_by"] ?? v["groupBy"] ?? v["group_by"];
    if (Array.isArray(pb)) pb = pb.join(", ");

    let sc = v["selectColumns"];
    if (typeof sc === "string") {
      sc = sc.includes(",") ? sc.split(",").map((s) => s.trim()) : [sc];
    }

    return {
      ...v,
      orderBy: ob,
      partitionBy: pb,
      selectColumns: sc,
      asColumn: v["asColumn"] ?? v["as_column"] ?? v["alias"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "Table is required"),
    orderBy: z.string().min(1, "orderBy is required").refine(val => !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the order condition." }).refine(val => !val.includes(";"), { message: "Invalid characters in orderBy" }),
    partitionBy: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the partition condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in partitionBy" }),
    selectColumns: z.array(z.string().refine(val => !val.includes(";"), { message: "Invalid characters in selectColumns" })).optional(),
    asColumn: z.string().min(1, "asColumn cannot be empty").refine(val => !val.includes(";") && !val.includes("`"), { message: "Invalid characters in asColumn" }).default("row_number"),
    where: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the filter condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in where clause" }),
    limit: z.coerce.number().min(1).max(1000).default(10),
    offset: z.coerce.number().min(0).default(0),
  })
);

export const StatsRankSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name (Required). Anti-Hallucination Hint: Do not pass a full SQL query here."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  orderBy: z
    .string()
    .optional()
    .describe("Column(s) to order by (determines rank). Required."),
  order_by: z.string().optional().describe("Alias for orderBy"),
  sort: z.string().optional().describe("Alias for orderBy"),
  sortBy: z.string().optional().describe("Alias for orderBy"),
  partitionBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to partition by"),
  partition_by: z.string().optional().describe("Alias for partitionBy"),
  groupBy: z.string().optional().describe("Alias for partitionBy"),
  group_by: z.string().optional().describe("Alias for partitionBy"),
  selectColumns: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Columns to include in result"),
  method: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Rank function type (default: rank)"),
  where: z.string().optional().describe("Filter condition. Anti-Hallucination Hint: Pass only the condition (e.g. 'amount > 100'), NOT a full SELECT query."),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows to skip (default: 0)"),
  rankType: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for method"),
  rank_type: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for method"),
  type: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for method"),
  asColumn: z.string().optional().describe("Alias for the output column"),
  as_column: z.string().optional().describe("Alias for asColumn"),
  alias: z.string().optional().describe("Alias for asColumn"),
});

export const StatsRankSchema = z.preprocess(
  (val: unknown) => {
    const v = preprocessJsonColumnParams(val) as Record<string, unknown>;

    let ob = v["orderBy"] ?? v["order_by"] ?? v["sort"] ?? v["sortBy"];
    if (Array.isArray(ob)) ob = ob.join(", ");
    
    let pb = v["partitionBy"] ?? v["partition_by"] ?? v["groupBy"] ?? v["group_by"];
    if (Array.isArray(pb)) pb = pb.join(", ");

    let sc = v["selectColumns"];
    if (typeof sc === "string") {
      sc = sc.includes(",") ? sc.split(",").map((s) => s.trim()) : [sc];
    }

    return {
      ...v,
      orderBy: ob,
      partitionBy: pb,
      selectColumns: sc,
      method: v["method"] ?? v["rankType"] ?? v["rank_type"] ?? v["type"],
      asColumn: v["asColumn"] ?? v["as_column"] ?? v["alias"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "Table is required"),
    orderBy: z.string().min(1, "orderBy is required").refine(val => !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the order condition." }).refine(val => !val.includes(";"), { message: "Invalid characters in orderBy" }),
    partitionBy: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the partition condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in partitionBy" }),
    selectColumns: z.array(z.string().refine(val => !val.includes(";"), { message: "Invalid characters in selectColumns" })).optional(),
    method: z.enum(["rank", "dense_rank", "percent_rank"]).default("rank"),
    asColumn: z.string().min(1, "asColumn cannot be empty").refine(val => !val.includes(";") && !val.includes("`"), { message: "Invalid characters in asColumn" }).default("rank"),
    where: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the filter condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in where clause" }),
    limit: z.coerce.number().min(1).max(1000).default(10),
    offset: z.coerce.number().min(0).default(0),
  })
);

export const StatsLagLeadSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name (Required). Anti-Hallucination Hint: Do not pass a full SQL query here."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column to get lag/lead value from (Required)"),
  col: z.string().optional().describe("Alias for column"),
  valueColumn: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  fieldName: z.string().optional().describe("Alias for column"),
  c: z.string().optional().describe("Alias for column"),
  orderBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to order by (Required)"),
  order_by: z.string().optional().describe("Alias for orderBy"),
  sort: z.string().optional().describe("Alias for orderBy"),
  sortBy: z.string().optional().describe("Alias for orderBy"),
  direction: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("LAG (previous row) or LEAD (next row)"),
  offset: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows to look back/ahead (default: 1)"),
  defaultValue: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .describe("Default value if no row exists"),
  partitionBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to partition by"),
  partition_by: z.string().optional().describe("Alias for partitionBy"),
  groupBy: z.string().optional().describe("Alias for partitionBy"),
  group_by: z.string().optional().describe("Alias for partitionBy"),
  selectColumns: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition. Anti-Hallucination Hint: Pass only the condition (e.g. 'amount > 100'), NOT a full SELECT query."),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  paginationOffset: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows to skip (default: 0)"),
  asColumn: z.string().optional().describe("Alias for the output column"),
  as_column: z.string().optional().describe("Alias for asColumn"),
  alias: z.string().optional().describe("Alias for asColumn"),
});

export const StatsLagLeadSchema = z.preprocess(
  (val: unknown) => {
    const v = preprocessJsonColumnParams(val) as Record<string, unknown>;
    
    let ob = v["orderBy"] ?? v["order_by"] ?? v["sort"] ?? v["sortBy"];
    if (Array.isArray(ob)) ob = ob.join(", ");
    
    let pb = v["partitionBy"] ?? v["partition_by"] ?? v["groupBy"] ?? v["group_by"];
    if (Array.isArray(pb)) pb = pb.join(", ");

    let sc = v["selectColumns"];
    if (typeof sc === "string") {
      sc = sc.includes(",") ? sc.split(",").map((s) => s.trim()) : [sc];
    }

    return {
      ...v,
      orderBy: ob,
      partitionBy: pb,
      selectColumns: sc,
      asColumn: v["asColumn"] ?? v["as_column"] ?? v["alias"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "Table is required"),
    column: z.string().min(1, "Column is required"),
    orderBy: z.string().min(1, "orderBy is required").refine(val => !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the order condition." }).refine(val => !val.includes(";"), { message: "Invalid characters in orderBy" }),
    direction: z.preprocess((val: unknown) => typeof val === "string" ? val.toLowerCase() : val, z.enum(["lag", "lead"])).default("lag"),
    offset: z.coerce.number().min(1).default(1),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).transform(v => String(v)).optional(),
    partitionBy: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the partition condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in partitionBy" }),
    selectColumns: z.array(z.string().refine(val => !val.includes(";"), { message: "Invalid characters in selectColumns" })).optional(),
    where: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the filter condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in where clause" }),
    limit: z.coerce.number().min(1).max(1000).default(10),
    paginationOffset: z.coerce.number().min(0).default(0),
    asColumn: z.string().min(1, "asColumn cannot be empty").refine(val => !val.includes(";") && !val.includes("`"), { message: "Invalid characters in asColumn" }).optional(),
  })
);

export const StatsRunningTotalSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name (Required). Anti-Hallucination Hint: Do not pass a full SQL query here."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column to sum (Required)"),
  col: z.string().optional().describe("Alias for column"),
  valueColumn: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  fieldName: z.string().optional().describe("Alias for column"),
  c: z.string().optional().describe("Alias for column"),
  orderBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to order by (Required)"),
  order_by: z.string().optional().describe("Alias for orderBy"),
  sort: z.string().optional().describe("Alias for orderBy"),
  sortBy: z.string().optional().describe("Alias for orderBy"),
  partitionBy: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Reset running total for each partition"),
  partition_by: z.string().optional().describe("Alias for partitionBy"),
  groupBy: z.string().optional().describe("Alias for partitionBy"),
  group_by: z.string().optional().describe("Alias for partitionBy"),
  selectColumns: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition. Anti-Hallucination Hint: Pass only the condition (e.g. 'amount > 100'), NOT a full SELECT query."),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows to skip (default: 0)"),
  asColumn: z.string().optional().describe("Alias for the output column"),
  as_column: z.string().optional().describe("Alias for asColumn"),
  alias: z.string().optional().describe("Alias for asColumn"),
});

export const StatsRunningTotalSchema = z.preprocess(
  (val: unknown) => {
    const v = preprocessJsonColumnParams(val) as Record<string, unknown>;
    
    let ob = v["orderBy"] ?? v["order_by"] ?? v["sort"] ?? v["sortBy"];
    if (Array.isArray(ob)) ob = ob.join(", ");
    
    let pb = v["partitionBy"] ?? v["partition_by"] ?? v["groupBy"] ?? v["group_by"];
    if (Array.isArray(pb)) pb = pb.join(", ");

    let sc = v["selectColumns"];
    if (typeof sc === "string") {
      sc = sc.includes(",") ? sc.split(",").map((s) => s.trim()) : [sc];
    }

    return {
      ...v,
      orderBy: ob,
      partitionBy: pb,
      selectColumns: sc,
      asColumn: v["asColumn"] ?? v["as_column"] ?? v["alias"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "Table is required"),
    column: z.string().min(1, "Column is required"),
    orderBy: z.string().min(1, "orderBy is required").refine(val => !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the order condition." }).refine(val => !val.includes(";"), { message: "Invalid characters in orderBy" }),
    partitionBy: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the partition condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in partitionBy" }),
    selectColumns: z.array(z.string().refine(val => !val.includes(";"), { message: "Invalid characters in selectColumns" })).optional(),
    asColumn: z.string().min(1, "asColumn cannot be empty").refine(val => !val.includes(";") && !val.includes("`"), { message: "Invalid characters in asColumn" }).default("running_total"),
    where: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the filter condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in where clause" }),
    limit: z.coerce.number().min(1).max(1000).default(10),
    offset: z.coerce.number().min(0).default(0),
  })
);

export const StatsMovingAvgSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name (Required). Anti-Hallucination Hint: Do not pass a full SQL query here."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Numeric column to average (Required)"),
  col: z.string().optional().describe("Alias for column"),
  valueColumn: z.string().optional().describe("Alias for column"),
  columnName: z.string().optional().describe("Alias for column"),
  fieldName: z.string().optional().describe("Alias for column"),
  c: z.string().optional().describe("Alias for column"),
  orderBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to order by (Required)"),
  order_by: z.string().optional().describe("Alias for orderBy"),
  sort: z.string().optional().describe("Alias for orderBy"),
  sortBy: z.string().optional().describe("Alias for orderBy"),
  windowSize: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows in the moving window"),
  window_size: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for windowSize"),
  size: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for windowSize"),
  period: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for windowSize"),
  partitionBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to partition by"),
  partition_by: z.string().optional().describe("Alias for partitionBy"),
  groupBy: z.string().optional().describe("Alias for partitionBy"),
  group_by: z.string().optional().describe("Alias for partitionBy"),
  selectColumns: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition. Anti-Hallucination Hint: Pass only the condition (e.g. 'amount > 100'), NOT a full SELECT query."),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows to skip (default: 0)"),
  asColumn: z.string().optional().describe("Alias for the output column"),
  as_column: z.string().optional().describe("Alias for asColumn"),
  alias: z.string().optional().describe("Alias for asColumn"),
});

export const StatsMovingAvgSchema = z.preprocess(
  (val: unknown) => {
    const v = preprocessJsonColumnParams(val) as Record<string, unknown>;
    
    let ob = v["orderBy"] ?? v["order_by"] ?? v["sort"] ?? v["sortBy"];
    if (Array.isArray(ob)) ob = ob.join(", ");
    
    let pb = v["partitionBy"] ?? v["partition_by"] ?? v["groupBy"] ?? v["group_by"];
    if (Array.isArray(pb)) pb = pb.join(", ");

    let sc = v["selectColumns"];
    if (typeof sc === "string") {
      sc = sc.includes(",") ? sc.split(",").map((s) => s.trim()) : [sc];
    }

    return {
      ...v,
      orderBy: ob,
      partitionBy: pb,
      selectColumns: sc,
      windowSize: v["windowSize"] ?? v["window_size"] ?? v["size"] ?? v["period"],
      asColumn: v["asColumn"] ?? v["as_column"] ?? v["alias"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "Table is required"),
    column: z.string().min(1, "Column is required"),
    orderBy: z.string().min(1, "orderBy is required").refine(val => !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the order condition." }).refine(val => !val.includes(";"), { message: "Invalid characters in orderBy" }),
    windowSize: z.coerce.number().int("windowSize must be an integer").min(1).default(3),
    partitionBy: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the partition condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in partitionBy" }),
    selectColumns: z.array(z.string().refine(val => !val.includes(";"), { message: "Invalid characters in selectColumns" })).optional(),
    asColumn: z.string().min(1, "asColumn cannot be empty").refine(val => !val.includes(";") && !val.includes("`"), { message: "Invalid characters in asColumn" }).default("moving_avg"),
    where: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the filter condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in where clause" }),
    limit: z.coerce.number().int().min(1).max(1000).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  })
);

export const StatsNtileSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name (Required). Anti-Hallucination Hint: Do not pass a full SQL query here."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  orderBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to order by (Required)"),
  order_by: z.string().optional().describe("Alias for orderBy"),
  sort: z.string().optional().describe("Alias for orderBy"),
  sortBy: z.string().optional().describe("Alias for orderBy"),
  buckets: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of buckets (e.g., 4 for quartiles)"),
  quantiles: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for buckets"),
  n: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Alias for buckets"),
  partitionBy: z.union([z.string(), z.array(z.string()), z.number()]).optional().describe("Column(s) to partition by"),
  partition_by: z.string().optional().describe("Alias for partitionBy"),
  groupBy: z.string().optional().describe("Alias for partitionBy"),
  group_by: z.string().optional().describe("Alias for partitionBy"),
  selectColumns: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition. Anti-Hallucination Hint: Pass only the condition (e.g. 'amount > 100'), NOT a full SELECT query."),
  filter: z.string().optional().describe("Alias for where"),
  condition: z.string().optional().describe("Alias for where"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
  limit: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Maximum rows to return (default: 10)"),
  offset: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("Number of rows to skip (default: 0)"),
});

export const StatsNtileSchema = z.preprocess(
  (val: unknown) => {
    const v = preprocessJsonColumnParams(val) as Record<string, unknown>;
    
    let ob = v["orderBy"] ?? v["order_by"] ?? v["sort"] ?? v["sortBy"];
    if (Array.isArray(ob)) ob = ob.join(", ");
    
    let pb = v["partitionBy"] ?? v["partition_by"] ?? v["groupBy"] ?? v["group_by"];
    if (Array.isArray(pb)) pb = pb.join(", ");

    let sc = v["selectColumns"];
    if (typeof sc === "string") {
      sc = sc.includes(",") ? sc.split(",").map((s) => s.trim()) : [sc];
    }

    return {
      ...v,
      orderBy: ob,
      partitionBy: pb,
      selectColumns: sc,
      buckets: v["buckets"] ?? v["quantiles"] ?? v["n"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "Table is required"),
    orderBy: z.string().min(1, "orderBy is required").refine(val => !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the order condition." }).refine(val => !val.includes(";"), { message: "Invalid characters in orderBy" }),
    buckets: z.coerce.number().int("buckets must be an integer").min(1).default(4),
    partitionBy: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the partition condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in partitionBy" }),
    selectColumns: z.array(z.string().refine(val => !val.includes(";"), { message: "Invalid characters in selectColumns" })).optional(),
    where: z.string().optional().refine(val => !val || !/^\s*SELECT\s/i.test(val), { message: "Do not pass a full SELECT query. Pass only the filter condition." }).refine(val => !val?.includes(";"), { message: "Invalid characters in where clause" }),
    limit: z.coerce.number().int().min(1).max(1000).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  })
);
