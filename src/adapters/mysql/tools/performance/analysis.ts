/**
 * MySQL Performance Tools - Analysis
 *
 * Query analysis and performance monitoring tools.
 * 8 tools: explain, explain_analyze, slow_queries, query_stats, index_usage, table_stats, buffer_pool_stats, thread_stats.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ExplainSchema,
  ExplainSchemaBase,
  ExplainAnalyzeSchema,
  ExplainAnalyzeSchemaBase,
  SlowQuerySchema,
  SlowQuerySchemaBase,
  QueryStatsSchema,
  QueryStatsSchemaBase,
  IndexUsageSchema,
  IndexUsageSchemaBase,
  TableStatsSchema,
  TableStatsSchemaBase,
} from "../../schemas/index.js";
import { z } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

/**
 * Maximum reasonable timer value in milliseconds (24 hours).
 * Values exceeding this threshold are timer overflow artifacts from
 * performance_schema's unsigned 64-bit picosecond counters wrapping.
 */
const MAX_TIMER_MS = 86_400_000;

/**
 * Sanitize timer fields in query result rows.
 * Overflowed values (> 24 hours) are clamped to -1 with an `overflow: true` flag.
 */
function sanitizeTimerRows(
  rows: Record<string, unknown>[] | undefined,
  timerFields: string[],
): Record<string, unknown>[] {
  if (!rows) return [];
  return rows.map((row) => {
    let hasOverflow = false;
    const sanitized = { ...row };
    for (const field of timerFields) {
      const value = sanitized[field];
      const numValue =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? parseFloat(value)
            : NaN;
      if (!isNaN(numValue) && numValue > MAX_TIMER_MS) {
        sanitized[field] = -1;
        hasOverflow = true;
      } else if (!isNaN(numValue)) {
        sanitized[field] = numValue;
      }
    }
    if (hasOverflow) {
      sanitized["overflow"] = true;
    }
    return sanitized;
  });
}

function optimizeExplainJson(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(optimizeExplainJson);
  }
  if (typeof node === "object" && node !== null) {
    const optimized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      // Strip verbose arrays and deep cost details to conserve tokens
      if (key === "used_columns" || key === "cost_info") {
        continue;
      }
      optimized[key] = optimizeExplainJson(value);
    }
    return optimized;
  }
  return node;
}

export function createExplainTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_explain",
    title: "MySQL EXPLAIN",
    description: "Get query execution plan using EXPLAIN.",
    group: "performance",
    inputSchema: ExplainSchemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { query, format } = ExplainSchema.parse(params);
        const sql = `EXPLAIN FORMAT=${format} ${query}`;
        const result = await adapter.executeReadQuery(sql);

        if (format === "JSON" && result.rows?.[0] !== undefined) {
          const explainRow = result.rows[0];
          const jsonStr = explainRow["EXPLAIN"];
          if (typeof jsonStr === "string") {
            const parsed = JSON.parse(jsonStr) as unknown;
            const optimizedPlan = optimizeExplainJson(parsed);
            const response = { success: true, data: { plan: optimizedPlan } };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
          }
        }

        const response = { success: true, data: { plan: result.rows } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createExplainAnalyzeTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_explain_analyze",
    title: "MySQL EXPLAIN ANALYZE",
    description:
      "Get query execution plan with actual timing using EXPLAIN ANALYZE (MySQL 8.0+). Only TREE format is supported.",
    group: "performance",
    inputSchema: ExplainAnalyzeSchemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { query, format } = ExplainAnalyzeSchema.parse(params);

        // MySQL does not support EXPLAIN ANALYZE with FORMAT=JSON
        // (requires explain_json_format_version=2 which is not widely available).
        // Return a descriptive error for JSON format requests.
        if (format === "JSON") {
          const response = {
            success: false,
            error:
              "EXPLAIN ANALYZE does not support FORMAT=JSON. Use FORMAT=TREE (default) instead.",
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        const sql = `EXPLAIN ANALYZE FORMAT=${format} ${query}`;
        const result = await adapter.executeReadQuery(sql);
        const response = { success: true, data: { analysis: result.rows } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (error) {
        return formatHandlerErrorResponse(error);
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
    inputSchema: SlowQuerySchemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
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
          sql += ` WHERE AVG_TIMER_WAIT > ${minTime * 1000000000000}`;
        }

        const actualLimit = Math.min(limit, 100);

        sql += ` ORDER BY AVG_TIMER_WAIT DESC LIMIT ${actualLimit}`;

        const result = await adapter.executeReadQuery(sql);
        const response = {
          success: true,
          data: {
            slowQueries: sanitizeTimerRows(result.rows, [
              "avg_time_ms",
              "total_time_ms",
            ]),
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createQueryStatsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_query_stats",
    title: "MySQL Query Stats",
    description: "Get query statistics from performance_schema.",
    group: "performance",
    inputSchema: QueryStatsSchemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { orderBy, limit } = QueryStatsSchema.parse(params);
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
                LIMIT ${Math.min(limit, 20)}
            `;

        const result = await adapter.executeReadQuery(sql);
        const response = {
          success: true,
          data: {
            queries: sanitizeTimerRows(result.rows, [
              "avg_time_ms",
              "max_time_ms",
              "total_time_ms",
            ]),
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, limit } = IndexUsageSchema.parse(params);

        // P154: Check table existence when a specific table is requested
        if (table) {
          const check = await adapter.executeReadQuery(
            `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [table],
          );
          if (!check.rows || check.rows.length === 0) {
            const response = {
              success: false,
              error: `Table '${table}' doesn't exist`,
              code: "NOT_FOUND",
              category: "database",
              suggestion:
                "Verify the table name exists in the target database.",
              recoverable: true,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
            );
            return { ...response, metrics: { tokenEstimate } };
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

        sql += ` ORDER BY count_read + count_write DESC LIMIT ${Math.min(limit, 100)}`;

        const result = await adapter.executeReadQuery(
          sql,
          table ? [table] : [],
        );
        const response = { success: true, data: { indexUsage: result.rows } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
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
          const response = {
            success: false,
            error: `Table '${table}' doesn't exist`,
            code: "NOT_FOUND",
            category: "database",
            suggestion: "Verify the table name exists in the target database.",
            recoverable: true,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

        const response = { success: true, data: { stats: result.rows[0] } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const result = await adapter.executeReadQuery(
          `SELECT POOL_ID, POOL_SIZE, FREE_BUFFERS, DATABASE_PAGES,
                OLD_DATABASE_PAGES, MODIFIED_DATABASE_PAGES, PENDING_DECOMPRESS,
                PENDING_READS, PENDING_FLUSH_LRU, PENDING_FLUSH_LIST,
                PAGES_MADE_YOUNG, PAGES_NOT_MADE_YOUNG,
                PAGES_MADE_YOUNG_RATE, PAGES_MADE_NOT_YOUNG_RATE,
                NUMBER_PAGES_READ, NUMBER_PAGES_CREATED, NUMBER_PAGES_WRITTEN,
                PAGES_READ_RATE, PAGES_CREATE_RATE, PAGES_WRITTEN_RATE,
                HIT_RATE, YOUNG_MAKE_PER_THOUSAND_GETS,
                NOT_YOUNG_MAKE_PER_THOUSAND_GETS
         FROM information_schema.INNODB_BUFFER_POOL_STATS`,
        );

        const response = {
          success: true,
          data: { bufferPoolStats: result.rows },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createThreadStatsTool(adapter: MySQLAdapter): ToolDefinition {
  const schemaBase = z.object({
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of threads to return (default: 5)"),
  });

  const schema = z.object({
    limit: z.number().int().positive().optional().default(5),
  });

  return {
    name: "mysql_thread_stats",
    title: "MySQL Thread Stats",
    description: "Get thread activity statistics.",
    group: "performance",
    inputSchema: schemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit } = schema.parse(params);
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
                LIMIT ${Math.min(limit, 50)}
            `);

        // Strip null values to conserve tokens
        const threads = result.rows?.map((row) => {
          const clean: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== null && value !== undefined) {
              clean[key] = value;
            }
          }
          return clean;
        });

        const response = { success: true, data: { threads } };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
