/**
 * MySQL Performance Tools - Analysis
 *
 * Query analysis and performance monitoring tools.
 * 8 tools: explain, explain_analyze, slow_queries, query_stats, index_usage, table_stats, buffer_pool_stats, thread_stats.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ExplainSchema,
  ExplainSchemaBase,
  SlowQuerySchema,
  IndexUsageSchema,
  IndexUsageSchemaBase,
  TableStatsSchema,
  TableStatsSchemaBase,
} from "../../types.js";
import { z } from "zod";

export function createExplainTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_explain",
    title: "MySQL EXPLAIN",
    description: "Get query execution plan using EXPLAIN.",
    group: "performance",
    inputSchema: ExplainSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { query, format } = ExplainSchema.parse(params);

      const sql =
        format === "JSON"
          ? `EXPLAIN FORMAT=JSON ${query}`
          : format === "TREE"
            ? `EXPLAIN FORMAT=TREE ${query}`
            : `EXPLAIN ${query}`;

      try {
        const result = await adapter.executeReadQuery(sql);

        if (format === "JSON" && result.rows?.[0] !== undefined) {
          const explainRow = result.rows[0];
          const jsonStr = explainRow["EXPLAIN"];
          if (typeof jsonStr === "string") {
            return { plan: JSON.parse(jsonStr) as unknown };
          }
        }

        return { plan: result.rows };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, error: msg };
        }
        return { success: false, error: msg };
      }
    },
  };
}

export function createExplainAnalyzeTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    query: z.string().describe("SQL query to analyze"),
    format: z.enum(["JSON", "TREE"]).optional().default("TREE"),
  });

  return {
    name: "mysql_explain_analyze",
    title: "MySQL EXPLAIN ANALYZE",
    description:
      "Get query execution plan with actual timing using EXPLAIN ANALYZE (MySQL 8.0+). Only TREE format is supported.",
    group: "performance",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { query, format } = schema.parse(params);

      // MySQL does not support EXPLAIN ANALYZE with FORMAT=JSON
      // (requires explain_json_format_version=2 which is not widely available).
      // Return a descriptive error for JSON format requests.
      if (format === "JSON") {
        return {
          supported: false,
          reason:
            "EXPLAIN ANALYZE does not support FORMAT=JSON. Use FORMAT=TREE (default) instead.",
        };
      }

      const sql = `EXPLAIN ANALYZE FORMAT=${format} ${query}`;

      try {
        const result = await adapter.executeReadQuery(sql);
        return { analysis: result.rows };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, error: msg };
        }
        return { success: false, error: msg };
      }
    },
  };
}

export function createSlowQueriesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_slow_queries",
    title: "MySQL Slow Queries",
    description: "Get slow queries from performance_schema (if available).",
    group: "performance",
    inputSchema: SlowQuerySchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { limit, minTime } = SlowQuerySchema.parse(params);

      let sql = `
                SELECT 
                    LEFT(DIGEST_TEXT, 200) as query,
                    COUNT_STAR as executions,
                    AVG_TIMER_WAIT/1000000000 as avg_time_ms,
                    SUM_TIMER_WAIT/1000000000 as total_time_ms,
                    SUM_ROWS_EXAMINED as rows_examined,
                    SUM_ROWS_SENT as rows_sent
                FROM performance_schema.events_statements_summary_by_digest
            `;

      if (minTime !== undefined) {
        sql += ` WHERE AVG_TIMER_WAIT > ${minTime * 1000000000}`;
      }

      sql += ` ORDER BY AVG_TIMER_WAIT DESC LIMIT ${limit}`;

      const result = await adapter.executeReadQuery(sql);
      return { slowQueries: result.rows };
    },
  };
}

export function createQueryStatsTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    orderBy: z
      .enum(["total_time", "avg_time", "executions"])
      .optional()
      .default("total_time"),
    limit: z.number().optional().default(10),
  });

  return {
    name: "mysql_query_stats",
    title: "MySQL Query Stats",
    description: "Get query statistics from performance_schema.",
    group: "performance",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { orderBy, limit } = schema.parse(params);

      const orderColumn = {
        total_time: "SUM_TIMER_WAIT",
        avg_time: "AVG_TIMER_WAIT",
        executions: "COUNT_STAR",
      }[orderBy];

      const sql = `
                SELECT 
                    SCHEMA_NAME as database_name,
                    LEFT(DIGEST_TEXT, 200) as query_text,
                    COUNT_STAR as execution_count,
                    AVG_TIMER_WAIT/1000000000 as avg_time_ms,
                    MAX_TIMER_WAIT/1000000000 as max_time_ms,
                    SUM_TIMER_WAIT/1000000000 as total_time_ms,
                    SUM_ROWS_EXAMINED as total_rows_examined,
                    SUM_ROWS_SENT as total_rows_sent,
                    FIRST_SEEN as first_seen,
                    LAST_SEEN as last_seen
                FROM performance_schema.events_statements_summary_by_digest
                WHERE DIGEST_TEXT IS NOT NULL
                ORDER BY ${orderColumn} DESC
                LIMIT ${limit}
            `;

      const result = await adapter.executeReadQuery(sql);
      return { queries: result.rows };
    },
  };
}

export function createIndexUsageTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_index_usage",
    title: "MySQL Index Usage",
    description: "Get index usage statistics from performance_schema.",
    group: "performance",
    inputSchema: IndexUsageSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, limit } = IndexUsageSchema.parse(params);

      // P154: Check table existence when a specific table is requested
      if (table) {
        const check = await adapter.executeReadQuery(
          `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
          [table],
        );
        if (!check.rows || check.rows.length === 0) {
          return { exists: false, table };
        }
      }

      // Always filter to current database to avoid returning thousands of
      // MySQL internal indexes with zero counts
      let sql = `
                SELECT 
                    object_schema as database_name,
                    object_name as table_name,
                    index_name,
                    count_read,
                    count_write,
                    count_fetch,
                    count_insert,
                    count_update,
                    count_delete
                FROM performance_schema.table_io_waits_summary_by_index_usage
                WHERE index_name IS NOT NULL
                  AND object_schema = DATABASE()
            `;

      if (table) {
        sql += ` AND object_name = ?`;
      }

      sql += ` ORDER BY count_read + count_write DESC LIMIT ${limit}`;

      const result = await adapter.executeReadQuery(sql, table ? [table] : []);
      return { indexUsage: result.rows };
    },
  };
}

export function createTableStatsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_table_stats",
    title: "MySQL Table Stats",
    description:
      "Get detailed table statistics including size, rows, and engine info.",
    group: "performance",
    inputSchema: TableStatsSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table } = TableStatsSchema.parse(params);

      const sql = `
                SELECT 
                    TABLE_NAME as table_name,
                    ENGINE as engine,
                    ROW_FORMAT as row_format,
                    TABLE_ROWS as estimated_rows,
                    AVG_ROW_LENGTH as avg_row_length,
                    DATA_LENGTH as data_size_bytes,
                    INDEX_LENGTH as index_size_bytes,
                    DATA_FREE as free_space_bytes,
                    AUTO_INCREMENT as auto_increment,
                    CREATE_TIME as create_time,
                    UPDATE_TIME as update_time,
                    TABLE_COLLATION as collation
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
            `;

      const result = await adapter.executeReadQuery(sql, [table]);

      if (!result.rows || result.rows.length === 0) {
        return { exists: false, table };
      }

      return { stats: result.rows[0] };
    },
  };
}

export function createBufferPoolStatsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_buffer_pool_stats",
    title: "MySQL Buffer Pool Stats",
    description: "Get InnoDB buffer pool statistics.",
    group: "performance",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      // Use SELECT * for compatibility across MySQL versions
      // Different MySQL versions have different column sets
      const result = await adapter.executeReadQuery(
        `SELECT * FROM information_schema.INNODB_BUFFER_POOL_STATS`,
      );

      return { bufferPoolStats: result.rows };
    },
  };
}

export function createThreadStatsTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_thread_stats",
    title: "MySQL Thread Stats",
    description: "Get thread activity statistics.",
    group: "performance",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      const result = await adapter.executeReadQuery(`
                SELECT 
                    THREAD_ID,
                    NAME,
                    TYPE,
                    PROCESSLIST_ID,
                    PROCESSLIST_USER,
                    PROCESSLIST_HOST,
                    PROCESSLIST_DB,
                    PROCESSLIST_COMMAND,
                    PROCESSLIST_TIME,
                    PROCESSLIST_STATE,
                    CONNECTION_TYPE
                FROM performance_schema.threads
                WHERE PROCESSLIST_ID IS NOT NULL
                ORDER BY PROCESSLIST_TIME DESC
            `);

      return { threads: result.rows };
    },
  };
}
