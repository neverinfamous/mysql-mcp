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
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a table name. This tool expects a query."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a table name. This tool expects a query."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a schema name. This tool executes against the current database."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
}).strict();

export const ExplainSchema = z
  .preprocess(
    (data: unknown) => {
      const processed = preprocessQueryOnlyParams(data);
      if (typeof processed !== "object" || processed === null) return processed;
      const record = processed as Record<string, unknown>;
      return {
        ...record,
        table: record["table"] ?? record["tableName"],
        format: typeof record["format"] === "string" ? record["format"].toUpperCase() : record["format"],
      };
    },
    z.object({
      query: z.string().optional(),
      sql: z.string().optional(),
      format: z
        .enum(["TRADITIONAL", "JSON", "TREE"])
        .optional()
        .default("TREE"),
      table: z.string().optional(),
      tableName: z.string().optional(),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
    }).refine((data) => !data.schema && !data.database && !data.db, {
      message: "Anti-Hallucination Hint: mysql_explain executes against the current database. It does NOT accept a schema, database, or db string.",
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    format: data.format,
    table: data.table,
  }))
  .refine((data) => !data.table, {
    message: "Anti-Hallucination Hint: mysql_explain expects a query, not a table name.",
  })
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
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a table name. This tool expects a query."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a table name. This tool expects a query."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a schema name. This tool executes against the current database."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
}).strict();

export const ExplainAnalyzeSchema = z
  .preprocess(
    (data: unknown) => {
      const processed = preprocessQueryOnlyParams(data);
      if (typeof processed !== "object" || processed === null) return processed;
      const record = processed as Record<string, unknown>;
      return {
        ...record,
        table: record["table"] ?? record["tableName"],
        format: typeof record["format"] === "string" ? record["format"].toUpperCase() : record["format"],
      };
    },
    z.object({
      query: z.string().optional(),
      sql: z.string().optional(),
      format: z.enum(["TREE"]).optional().default("TREE"),
      table: z.string().optional(),
      tableName: z.string().optional(),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
    }).refine((data) => !data.schema && !data.database && !data.db, {
      message: "Anti-Hallucination Hint: mysql_explain_analyze executes against the current database. It does NOT accept a schema, database, or db string.",
    }),
  )
  .transform((data) => ({
    query: data.query ?? data.sql ?? "",
    format: data.format,
    table: data.table,
  }))
  .refine((data) => !data.table, {
    message: "Anti-Hallucination Hint: mysql_explain_analyze expects a query, not a table name.",
  })
  .refine((data) => data.query !== "", {
    message: "query (or sql alias) is required",
  })
  .refine((data) => {
    if (!data.query) return true;
    return /^\s*(SELECT|WITH)\b/i.test(data.query);
  }, {
    message: "Anti-Hallucination Hint: EXPLAIN ANALYZE actually executes the query and can mutate data. Only SELECT or WITH queries are permitted.",
  });

// --- SlowQuery (no table/query aliases — simple passthrough) ---
export const SlowQuerySchemaBase = z.object({
  limit: z.union([z.number(), z.string()]).optional().describe("Number of slow queries to return (max 100)"),
  minTime: z.union([z.number(), z.string()]).optional().describe("Minimum query time in seconds"),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server slow queries."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server slow queries."),
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server slow queries."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server slow queries."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific schema name. This tool returns overall server slow queries."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server slow queries."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server slow queries."),
}).strict();

export const SlowQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .default(3)
    .describe("Number of slow queries to return"),
  minTime: z.coerce
    .number()
    .min(0)
    .max(86400) // 1 day max to prevent Infinity math issues
    .optional()
    .describe("Minimum query time in seconds"),
  query: z.string().optional(),
  sql: z.string().optional(),
  table: z.string().optional(),
  tableName: z.string().optional(),
  schema: z.string().optional(),
  database: z.string().optional(),
  db: z.string().optional(),
}).refine((data) => !data.query && !data.sql && !data.table && !data.tableName && !data.schema && !data.database && !data.db, {
  message: "Anti-Hallucination Hint: mysql_slow_queries returns overall server slow queries. It does NOT accept a specific query, sql, table, tableName, schema, or database string.",
});

// --- QueryStats (no table/query aliases — simple passthrough) ---
export const QueryStatsSchemaBase = z.object({
  orderBy: z.enum(["total_time", "avg_time", "executions"]).optional().describe("Order results by metric"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of queries to return (max 100)"),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server query stats. Use explain or explainAnalyze instead."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server query stats. Use explain or explainAnalyze instead."),
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server query stats."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server query stats."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific schema name. This tool returns overall server query stats."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server query stats."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server query stats."),
}).strict();

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
    .max(100)
    .optional()
    .default(3)
    .describe("Maximum number of queries to return"),
  query: z.string().optional(),
  sql: z.string().optional(),
  table: z.string().optional(),
  tableName: z.string().optional(),
  schema: z.string().optional(),
  database: z.string().optional(),
  db: z.string().optional(),
}).refine((data) => !data.query && !data.sql && !data.table && !data.tableName && !data.schema && !data.database && !data.db, {
  message: "Anti-Hallucination Hint: mysql_query_stats returns overall server stats. It does NOT accept a specific query, sql, table, tableName, schema, or database string. Use explain or explainAnalyze to analyze a specific query.",
});

// --- IndexUsage ---
export const IndexUsageSchemaBase = z.object({
  table: z.string().optional().describe("Filter by table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of indexes to return (max 100)"),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific schema name. This tool only uses the current database."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool only uses the current database."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool only uses the current database."),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a query or sql string. This tool analyzes index usage."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a query or sql string. This tool analyzes index usage."),
  orderBy: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass an orderBy string. This tool orders by usage automatically."),
  sort: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a sort string. This tool orders by usage automatically."),
  sortBy: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a sortBy string. This tool orders by usage automatically."),
}).strict();

export const IndexUsageSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).optional().default(5),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      orderBy: z.string().optional(),
      sort: z.string().optional(),
      sortBy: z.string().optional(),
    })
    .strict()
    .refine((data) => !data.schema && !data.database && !data.db && !data.query && !data.sql && !data.orderBy && !data.sort && !data.sortBy, {
      message: "Anti-Hallucination Hint: mysql_index_usage operates on the current database and table. It does NOT accept a schema, database, db, query, sql, orderBy, sort, or sortBy string.",
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? "",
    limit: data.limit,
  }));

// --- BufferPoolStats ---
export const BufferPoolStatsSchemaBase = z.object({
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server buffer pool stats."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server buffer pool stats."),
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server buffer pool stats."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server buffer pool stats."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific schema name. This tool returns overall server buffer pool stats."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server buffer pool stats."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server buffer pool stats."),
  limit: z.union([z.number(), z.string()]).optional().describe("Anti-Hallucination Hint: Do NOT pass a limit. This tool returns all buffer pool stats."),
}).strict();

export const BufferPoolStatsSchema = z
  .object({
    query: z.string().optional(),
    sql: z.string().optional(),
    table: z.string().optional(),
    tableName: z.string().optional(),
    schema: z.string().optional(),
    database: z.string().optional(),
    db: z.string().optional(),
    limit: z.union([z.number(), z.string()]).optional(),
  })
  .strict()
  .refine((data) => !data.query && !data.sql && !data.table && !data.tableName && !data.schema && !data.database && !data.db && data.limit === undefined, {
    message: "Anti-Hallucination Hint: mysql_buffer_pool_stats returns overall server stats. It does NOT accept a specific query, sql, table, tableName, schema, database, db, or limit string.",
  });

// --- ThreadStats ---
export const ThreadStatsSchemaBase = z.object({
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of threads to return (default: 5, max: 100)"),
  maxThreads: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  threads: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server thread stats."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server thread stats."),
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server thread stats."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server thread stats."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific schema name. This tool returns overall server thread stats."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server thread stats."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool returns overall server thread stats."),
  status: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a status. This tool returns all active threads."),
  state: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a state. This tool returns all active threads."),
  user: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a user. This tool returns all active threads."),
}).strict();

export const ThreadStatsSchema = z
  .preprocess(
    (data: unknown) => {
      if (typeof data !== "object" || data === null) return data;
      const record = data as Record<string, unknown>;
      return {
        ...record,
        limit: record["limit"] ?? record["maxThreads"] ?? record["threads"],
      };
    },
    z.object({
      limit: z.coerce.number().int().positive().max(100).optional().default(5),
      maxThreads: z.coerce.number().optional(),
      threads: z.coerce.number().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
      status: z.string().optional(),
      state: z.string().optional(),
      user: z.string().optional(),
    })
    .strict()
    .refine((data) => !data.query && !data.sql && !data.table && !data.tableName && !data.schema && !data.database && !data.db && !data.status && !data.state && !data.user, {
      message: "Anti-Hallucination Hint: mysql_thread_stats returns overall server stats. It does NOT accept a specific query, sql, table, tableName, schema, database, db, status, state, or user.",
    }),
  )
  .transform((data) => ({
    limit: data.limit,
  }));

// --- TableStats ---
export const TableStatsSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific schema name. This tool only uses the current database."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool only uses the current database."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool only uses the current database."),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a query or sql string. This tool analyzes table stats."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a query or sql string. This tool analyzes table stats."),
  limit: z.union([z.number(), z.string()]).optional().describe("Anti-Hallucination Hint: Do NOT pass a limit. This tool returns stats for a single table."),
}).strict();

export const TableStatsSchema = z
  .preprocess(
    preprocessTableParams,
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      limit: z.union([z.number(), z.string()]).optional(),
    })
    .strict()
    .refine((data) => !data.schema && !data.database && !data.db && !data.query && !data.sql && data.limit === undefined, {
      message: "Anti-Hallucination Hint: mysql_table_stats operates on the current database and table. It does NOT accept a schema, database, db, query, sql, or limit.",
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
  table: z.string().optional().describe("Table to analyze"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  queries: z.array(z.string()).optional()
    .describe("SQL queries to analyze with EXPLAIN for composite index recommendations"),
  includeRedundant: z.boolean().optional()
    .describe("Detect redundant/duplicate indexes (default: true)"),
  includeUnindexed: z.boolean().optional()
    .describe("Flag large tables without secondary indexes (default: true)"),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a schema name. This tool executes against the current database."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a query string. This tool expects an array of queries in the `queries` field."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a sql string. This tool expects an array of queries in the `queries` field."),
}).strict();

// Transformed schema for handler parsing
export const IndexRecommendationSchema = z
  .preprocess(
    (data: unknown) => {
      const processed = preprocessTableParams(data);
      if (typeof processed !== "object" || processed === null) return processed;
      const record = processed as Record<string, unknown>;
      return {
        ...record,
        schema: record["schema"] ?? record["database"] ?? record["db"],
        query: record["query"] ?? record["sql"],
      };
    },
    z.object({
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      queries: z.array(z.string()).optional(),
      includeRedundant: z.boolean().optional(),
      includeUnindexed: z.boolean().optional(),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
    }).refine((data) => !data.schema && !data.database && !data.db, {
      message: "Anti-Hallucination Hint: mysql_index_recommendation executes against the current database. It does NOT accept a schema, database, or db string.",
    }).refine((data) => !data.query && !data.sql, {
      message: "Anti-Hallucination Hint: mysql_index_recommendation expects an array of queries in the `queries` field. It does NOT accept a single query or sql string.",
    })
  )
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
  tbl: z.string().optional().describe("Alias for table"),
  table_name: z.string().optional().describe("Alias for table"),
  query: z.string().optional().describe("Original query"),
  sql: z.string().optional().describe("Alias for query"),
  indexName: z.string().optional().describe("Index name to force"),
  index: z.string().optional().describe("Alias for index name"),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a schema name. This tool executes against the current database."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool executes against the current database."),
}).strict();

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
      tbl: z.string().optional(),
      table_name: z.string().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      indexName: z.string().optional(),
      index: z.string().optional(),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
    }).strict().refine((data) => !data.schema && !data.database && !data.db, {
      message: "Anti-Hallucination Hint: mysql_force_index executes against the current database. It does NOT accept a schema, database, or db string.",
    }),
  )
  .transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? data.tbl ?? data.table_name ?? "",
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
    .union([z.number(), z.string()])
    .optional()
    .describe("Max/Avg variance multiplier threshold (default: 10.0)"),
  stdDevThreshold: z.union([z.number(), z.string()]).optional().describe("Alias for threshold"),
  minCalls: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Minimum call count to filter noise (default: 50)"),
  minExecutions: z.union([z.number(), z.string()]).optional().describe("Alias for minCalls"),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server query anomalies."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool returns overall server query anomalies."),
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server query anomalies."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool returns overall server query anomalies."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific schema name. This tool analyzes global workload variance."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool analyzes global workload variance."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific database name. This tool analyzes global workload variance."),
}).strict();

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
      query: z.string().optional(),
      sql: z.string().optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      schema: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
    }).strict().refine((data) => !data.query && !data.sql && !data.table && !data.tableName && !data.schema && !data.database && !data.db, {
      message: "Anti-Hallucination Hint: mysql_detect_query_anomalies analyzes global workload variance. It does NOT accept a specific query, sql, table, tableName, schema, database, or db string.",
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
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
  minSizeMb: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Minimum table size in MB to include (default: 10)"),
  minSize: z.union([z.number(), z.string()]).optional().describe("Alias for minSizeMb"),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a query or sql string. This tool analyzes tables, not queries."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a query or sql string. This tool analyzes tables, not queries."),
  limit: z.union([z.number(), z.string()]).optional().describe("Anti-Hallucination Hint: Do NOT pass a limit. This tool returns the top 50 bloated tables automatically."),
  orderBy: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass orderBy. This tool orders by fragmentation automatically."),
  sort: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass sort. This tool orders by fragmentation automatically."),
  sortBy: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass sortBy. This tool orders by fragmentation automatically."),
}).strict();

export const DetectBloatRiskSchema = z
  .preprocess(
    (data: unknown) => {
      const processed = preprocessTableParams(data);
      if (typeof processed !== "object" || processed === null) return processed;
      const record = processed as Record<string, unknown>;
      return {
        ...record,
        schema: record["schema"] ?? record["database"] ?? record["db"],
        minSizeMb: record["minSizeMb"] ?? record["minSize"],
      };
    },
    z.object({
      schema: z.string().optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      name: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
      minSizeMb: z.coerce.number().min(0).optional().default(10),
      minSize: z.coerce.number().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      limit: z.union([z.number(), z.string()]).optional(),
      orderBy: z.string().optional(),
      sort: z.string().optional(),
      sortBy: z.string().optional(),
    }).strict().refine((data) => !data.query && !data.sql && data.limit === undefined && !data.orderBy && !data.sort && !data.sortBy, {
      message: "Anti-Hallucination Hint: mysql_detect_bloat_risk analyzes tables, not queries. Do NOT pass a query, sql, limit, orderBy, sort, or sortBy.",
    }),
  )
  .transform((data) => ({
    schema: data.schema,
    table: data.table ?? data.tableName ?? data.name,
    minSizeMb: data.minSizeMb,
  }));

export const DetectConnectionSpikeSchemaBase = z.object({
  warningPercent: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Percentage threshold for flagging concentration (default: 70)"),
  windowMinutes: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Idle time window in minutes to flag connections (default: 5)"),
  warning_percent: z.union([z.number(), z.string()]).optional().describe("Alias for warningPercent"),
  window_minutes: z.union([z.number(), z.string()]).optional().describe("Alias for windowMinutes"),
  window: z.union([z.number(), z.string()]).optional().describe("Alias for windowMinutes"),
  time: z.union([z.number(), z.string()]).optional().describe("Alias for windowMinutes"),
  duration: z.union([z.number(), z.string()]).optional().describe("Alias for windowMinutes"),
  thresholdPercent: z.union([z.number(), z.string()]).optional().describe("Alias for warningPercent"),
  threshold: z.union([z.number(), z.string()]).optional().describe("Alias for warningPercent"),
  query: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool analyzes global connections."),
  sql: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific query or sql string. This tool analyzes global connections."),
  table: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool analyzes global connections."),
  tableName: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a specific table name. This tool analyzes global connections."),
  database: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool analyzes global connections."),
  db: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a database name. This tool analyzes global connections."),
  schema: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a schema name. This tool analyzes global connections."),
  user: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a user name. This tool analyzes global connections."),
  username: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a username. This tool analyzes global connections."),
  host: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a host. This tool analyzes global connections."),
  client: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a client. This tool analyzes global connections."),
  clientHost: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a clientHost. This tool analyzes global connections."),
  ip: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass an ip. This tool analyzes global connections."),
  address: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass an address. This tool analyzes global connections."),
  id: z.union([z.number(), z.string()]).optional().describe("Anti-Hallucination Hint: Do NOT pass an id. This tool analyzes global connections."),
  processId: z.union([z.number(), z.string()]).optional().describe("Anti-Hallucination Hint: Do NOT pass a processId. This tool analyzes global connections."),
  threadId: z.union([z.number(), z.string()]).optional().describe("Anti-Hallucination Hint: Do NOT pass a threadId. This tool analyzes global connections."),
  connectionId: z.union([z.number(), z.string()]).optional().describe("Anti-Hallucination Hint: Do NOT pass a connectionId. This tool analyzes global connections."),
}).strict();

export const DetectConnectionSpikeSchema = z
  .preprocess(
    (data: unknown) => {
      if (typeof data !== "object" || data === null) return data;
      const record = data as Record<string, unknown>;
      return {
        ...record,
        warningPercent: record["warningPercent"] ?? record["warning_percent"] ?? record["thresholdPercent"] ?? record["threshold"],
        windowMinutes: record["windowMinutes"] ?? record["window_minutes"] ?? record["window"] ?? record["time"] ?? record["duration"],
      };
    },
    z.object({
      warningPercent: z.coerce.number().min(0).max(100).optional().default(70),
      windowMinutes: z.coerce.number().int().min(1).max(1440).optional().default(5),
      warning_percent: z.coerce.number().optional(),
      window_minutes: z.coerce.number().optional(),
      window: z.coerce.number().optional(),
      time: z.coerce.number().optional(),
      duration: z.coerce.number().optional(),
      thresholdPercent: z.coerce.number().optional(),
      threshold: z.coerce.number().optional(),
      query: z.string().optional(),
      sql: z.string().optional(),
      table: z.string().optional(),
      tableName: z.string().optional(),
      database: z.string().optional(),
      db: z.string().optional(),
      schema: z.string().optional(),
      user: z.string().optional(),
      username: z.string().optional(),
      host: z.string().optional(),
      client: z.string().optional(),
      clientHost: z.string().optional(),
      ip: z.string().optional(),
      address: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass an address. This tool analyzes global connections."),
      id: z.coerce.number().optional().describe("Anti-Hallucination Hint: Do NOT pass an id. This tool analyzes global connections."),
      processId: z.coerce.number().optional().describe("Anti-Hallucination Hint: Do NOT pass a processId. This tool analyzes global connections."),
      threadId: z.coerce.number().optional().describe("Anti-Hallucination Hint: Do NOT pass a threadId. This tool analyzes global connections."),
      connectionId: z.coerce.number().optional().describe("Anti-Hallucination Hint: Do NOT pass a connectionId. This tool analyzes global connections."),
      connection_id: z.coerce.number().optional().describe("Anti-Hallucination Hint: Do NOT pass a connection_id. This tool analyzes global connections."),
      process_id: z.coerce.number().optional().describe("Anti-Hallucination Hint: Do NOT pass a process_id. This tool analyzes global connections."),
      thread_id: z.coerce.number().optional().describe("Anti-Hallucination Hint: Do NOT pass a thread_id. This tool analyzes global connections."),
      client_host: z.string().optional().describe("Anti-Hallucination Hint: Do NOT pass a client_host. This tool analyzes global connections."),
    }).strict().refine((data) => !data.query && !data.sql && !data.table && !data.tableName && !data.database && !data.db && !data.schema && !data.user && !data.username && !data.host && !data.client && !data.clientHost && !data.client_host && !data.ip && !data.address && data.id === undefined && data.processId === undefined && data.threadId === undefined && data.connectionId === undefined && data.connection_id === undefined && data.process_id === undefined && data.thread_id === undefined, {
      message: "Anti-Hallucination Hint: mysql_detect_connection_spike analyzes global connection pool patterns. It does NOT accept a specific query, sql, table, database, schema, user, host, client, or connection id.",
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
}).strict();

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
