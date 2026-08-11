/**
 * MySQL sys Schema Tools - Resource Monitoring
 *
 * Tools for monitoring database resources and objects.
 * 3 tools: schema_stats, innodb_lock_waits, memory_summary.
 */

import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  SysSchemaStatsOutputSchema,
  SysInnoDBLockWaitsOutputSchema,
  SysMemorySummaryOutputSchema,
} from "../../schemas/sysschema.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// Helpers
// =============================================================================

// =============================================================================
// Zod Schemas
// =============================================================================

const LimitSchemaBase = z.object({
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results to return"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
}).loose();

const LimitSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as { limit?: unknown; max?: unknown; count?: unknown };
    return {
      ...val,
      limit: v.limit ?? v.max ?? v.count,
    };
  },
  z.object({
    limit: z.coerce.number().int().positive().default(5),
    max: z.any().optional(),
    count: z.any().optional(),
  }).strict()
);

const SchemaStatsSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
  schemaName: z.string().optional().describe("Alias for schema"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
}).loose();

const SchemaStatsSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as { schema?: unknown; database?: unknown; db?: unknown; schemaName?: unknown; limit?: unknown; max?: unknown; count?: unknown };
    const resolvedSchema = v.schema ?? v.database ?? v.db ?? v.schemaName;
    return {
      ...val,
      schema: resolvedSchema === "" ? undefined : resolvedSchema,
      limit: v.limit ?? v.max ?? v.count,
    };
  },
  z.object({
    schema: z.string().optional(),
    limit: z.coerce.number().int().positive().default(5),
    database: z.any().optional(),
    db: z.any().optional(),
    schemaName: z.any().optional(),
    max: z.any().optional(),
    count: z.any().optional(),
  }).strict()
);

/**
 * Get schema object statistics
 */
export function createSysSchemaStatsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_sys_schema_stats",
    title: "MySQL Schema Statistics",
    description:
      "Get aggregated statistics for a schema including tables, indexes, and auto-increment status.",
    group: "sysschema",
    inputSchema: SchemaStatsSchemaBase,
    outputSchema: SysSchemaStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { schema, limit } = SchemaStatsSchema.parse(params);
        const actualLimit = Math.min(limit, 100);

        // P154: Schema existence check when explicitly provided
        if (schema) {
          const schemaCheck = await adapter.executeQuery(
            "WITH sys_query AS (SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?) SELECT * FROM sys_query",
            [schema],
          );
          if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
            return withTokenEstimate({
              success: false,
              error: `Schema '${schema}' does not exist`,
              code: "NOT_FOUND_ERROR",
              category: "not_found",
              recoverable: false,
            });
          }
        }

        // Resolve actual database name for response
        let resolvedSchema = schema;
        if (!resolvedSchema) {
          const dbResult = await adapter.executeQuery(
            "WITH sys_query AS (SELECT DATABASE() as db) SELECT * FROM sys_query",
          );
          const rows = dbResult.rows ?? [];
          const dbRow = rows[0];
          
          if (typeof dbRow?.["db"] !== "string" || dbRow["db"] === "") {
            return withTokenEstimate({
              success: false,
              error: "No database selected and no schema provided. Please specify a schema.",
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: true,
            });
          }
          
          resolvedSchema = dbRow["db"];
        }

        // Get table statistics
        const tableStatsQuery = `
                WITH sys_query AS (
                SELECT
                    t.table_schema,
                    t.table_name,
                    t.rows_fetched,
                    sys.format_time(t.fetch_latency) AS fetch_latency,
                    t.rows_inserted,
                    sys.format_time(t.insert_latency) AS insert_latency,
                    t.rows_updated,
                    sys.format_time(t.update_latency) AS update_latency,
                    t.rows_deleted,
                    sys.format_time(t.delete_latency) AS delete_latency
                FROM sys.x$schema_table_statistics t
                WHERE t.table_schema = COALESCE(?, DATABASE())
                ORDER BY (t.fetch_latency + t.insert_latency + t.update_latency + t.delete_latency) DESC
                LIMIT ${String(actualLimit)}
                ) SELECT * FROM sys_query
            `;

        // Get index statistics
        const indexStatsQuery = `
                WITH sys_query AS (
                SELECT
                    t.table_schema,
                    t.table_name,
                    t.index_name,
                    t.rows_selected,
                    sys.format_time(t.select_latency) AS select_latency,
                    t.rows_inserted,
                    sys.format_time(t.insert_latency) AS insert_latency,
                    t.rows_updated,
                    sys.format_time(t.update_latency) AS update_latency,
                    t.rows_deleted,
                    sys.format_time(t.delete_latency) AS delete_latency
                FROM sys.x$schema_index_statistics t
                WHERE t.table_schema = COALESCE(?, DATABASE())
                ORDER BY (t.select_latency + t.insert_latency + t.update_latency + t.delete_latency) DESC
                LIMIT ${String(actualLimit)}
                ) SELECT * FROM sys_query
            `;

        // Get auto-increment status
        const autoIncQuery = `
                WITH sys_query AS (
                SELECT
                    table_schema,
                    table_name,
                    column_name,
                    data_type,
                    column_type,
                    auto_increment_ratio
                FROM sys.schema_auto_increment_columns
                WHERE table_schema = COALESCE(?, DATABASE())
                ORDER BY auto_increment_ratio DESC
                LIMIT ${String(actualLimit)}
                ) SELECT * FROM sys_query
            `;

        const tableStats = await adapter.executeQuery(tableStatsQuery, [schema ?? null]);
        const indexStats = await adapter.executeQuery(indexStatsQuery, [schema ?? null]);
        const autoIncStats = await adapter.executeQuery(autoIncQuery, [schema ?? null]);

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "0 ps" && value !== "  0 ps" && value !== "0 bytes" && value !== "   0 bytes" && value !== "" && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        return withTokenEstimate({
          success: true,
          data: {
            tableStatistics: (tableStats.rows ?? []).map(cleanRow),
            indexStatistics: (indexStats.rows ?? []).map(cleanRow),
            autoIncrementStatus: autoIncStats.rows ?? [],
            tableStatisticsCount: (tableStats.rows ?? []).length,
            indexStatisticsCount: (indexStats.rows ?? []).length,
            autoIncrementStatusCount: (autoIncStats.rows ?? []).length,
            schemaName: resolvedSchema,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * Get InnoDB lock waits
 */
export function createSysInnoDBLockWaitsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_sys_innodb_lock_waits",
    title: "MySQL InnoDB Lock Waits",
    description:
      "Get current InnoDB lock contention information from sys schema.",
    group: "sysschema",
    inputSchema: LimitSchemaBase,
    outputSchema: SysInnoDBLockWaitsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit } = LimitSchema.parse(params);
        const actualLimit = Math.min(limit, 100);

        const query = `
                WITH sys_query AS (
                SELECT
                    wait_started,
                    wait_age,
                    locked_table,
                    locked_index,
                    locked_type,
                    waiting_trx_id,
                    waiting_trx_started,
                    waiting_trx_age,
                    waiting_trx_rows_locked,
                    waiting_trx_rows_modified,
                    waiting_query,
                    waiting_lock_mode,
                    blocking_trx_id,
                    blocking_trx_started,
                    blocking_trx_age,
                    blocking_trx_rows_locked,
                    blocking_trx_rows_modified,
                    blocking_query,
                    blocking_lock_mode
                FROM sys.innodb_lock_waits
                ORDER BY wait_started
                LIMIT ${String(actualLimit)}
                ) SELECT * FROM sys_query
            `;

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "0 ps" && value !== "  0 ps" && value !== "0 bytes" && value !== "   0 bytes" && value !== "" && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query);

        return withTokenEstimate({
          success: true,
          data: {
            rows: (result.rows ?? []).map(cleanRow),
            count: result.rows?.length ?? 0,
            hasContention: (result.rows?.length ?? 0) > 0,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * Get memory usage summary
 */
export function createSysMemorySummaryTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_sys_memory_summary",
    title: "MySQL Memory Summary",
    description: "Get memory usage summary by allocation type from sys schema.",
    group: "sysschema",
    inputSchema: LimitSchemaBase,
    outputSchema: SysMemorySummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit } = LimitSchema.parse(params);
        const actualLimit = Math.min(limit, 100);

        // Global memory summary
        const globalQuery = `
                WITH sys_query AS (
                SELECT
                    event_name,
                    current_count,
                    current_alloc,
                    current_avg_alloc,
                    high_count,
                    high_alloc,
                    high_avg_alloc
                FROM sys.memory_global_by_current_bytes
                LIMIT ${String(actualLimit)}
                ) SELECT * FROM sys_query
            `;

        // Memory by user
        const userQuery = `
                WITH sys_query AS (
                SELECT
                    user,
                    current_count_used,
                    current_allocated,
                    current_avg_alloc,
                    current_max_alloc,
                    total_allocated
                FROM sys.memory_by_user_by_current_bytes
                LIMIT ${String(actualLimit)}
                ) SELECT * FROM sys_query
            `;

        const globalStats = await adapter.executeQuery(globalQuery);
        const userStats = await adapter.executeQuery(userQuery);

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "0 ps" && value !== "  0 ps" && value !== "0 bytes" && value !== "   0 bytes" && value !== "" && value !== null) {
              cleaned[key] = value;
            }
          }
          return cleaned;
        };

        return withTokenEstimate({
          success: true,
          data: {
            globalMemory: (globalStats.rows ?? []).map(cleanRow),
            memoryByUser: (userStats.rows ?? []).map(cleanRow),
            globalMemoryCount: (globalStats.rows ?? []).length,
            memoryByUserCount: (userStats.rows ?? []).length,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return formatHandlerErrorResponse(err);
        }
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
