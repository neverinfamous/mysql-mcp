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
  limit: z.number().optional().describe("Maximum number of results to return"),
});

const LimitSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as { limit?: unknown };
    return {
      limit: v.limit,
    };
  },
  z.object({
    limit: z.coerce.number().int().positive().default(5),
  })
);

const SchemaStatsSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
  schemaName: z.string().optional().describe("Alias for schema"),
  limit: z.number().optional().describe("Maximum number of results"),
});

const SchemaStatsSchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as { schema?: unknown; database?: unknown; db?: unknown; schemaName?: unknown; limit?: unknown };
    return {
      schema: v.schema ?? v.database ?? v.db ?? v.schemaName,
      limit: v.limit,
    };
  },
  z.object({
    schema: z.string().optional(),
    limit: z.coerce.number().int().positive().default(5),
  })
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

        // P154: Schema existence check when explicitly provided
        if (schema) {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [schema],
          );
          if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
            return withTokenEstimate({
              success: false,
              error: `Schema '${schema}' does not exist`,
              code: "NOT_FOUND_ERROR",
              category: "not_found",
            });
          }
        }

        // Resolve actual database name for response
        let resolvedSchema = schema;
        if (!resolvedSchema) {
          const dbResult = await adapter.executeQuery(
            "SELECT DATABASE() as db",
          );
          const rows = dbResult.rows ?? [];
          const dbRow = rows[0];
          resolvedSchema = typeof dbRow?.["db"] === "string" ? dbRow["db"] : "unknown";
        }

        // Get table statistics
        const tableStatsQuery = `
                SELECT
                    table_schema,
                    table_name,
                    rows_fetched,
                    fetch_latency,
                    rows_inserted,
                    insert_latency,
                    rows_updated,
                    update_latency,
                    rows_deleted,
                    delete_latency
                FROM sys.schema_table_statistics
                WHERE table_schema = COALESCE(?, DATABASE())
                ORDER BY (fetch_latency + insert_latency + update_latency + delete_latency) DESC
                LIMIT ${String(limit)}
            `;

        // Get index statistics
        const indexStatsQuery = `
                SELECT
                    table_schema,
                    table_name,
                    index_name,
                    rows_selected,
                    select_latency,
                    rows_inserted,
                    insert_latency,
                    rows_updated,
                    update_latency,
                    rows_deleted,
                    delete_latency
                FROM sys.schema_index_statistics
                WHERE table_schema = COALESCE(?, DATABASE())
                ORDER BY (select_latency + insert_latency + update_latency + delete_latency) DESC
                LIMIT ${String(limit)}
            `;

        // Get auto-increment status
        const autoIncQuery = `
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
                LIMIT ${String(limit)}
            `;

        const [tableStats, indexStats, autoIncStats] = await Promise.all([
          adapter.executeQuery(tableStatsQuery, [schema ?? null]),
          adapter.executeQuery(indexStatsQuery, [schema ?? null]),
          adapter.executeQuery(autoIncQuery, [schema ?? null]),
        ]);

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
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

        const query = `
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
                LIMIT ${String(limit)}
            `;

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
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

        // Global memory summary
        const globalQuery = `
                SELECT
                    event_name,
                    current_count,
                    current_alloc,
                    current_avg_alloc,
                    high_count,
                    high_alloc,
                    high_avg_alloc
                FROM sys.memory_global_by_current_bytes
                ORDER BY current_alloc DESC
                LIMIT ${String(limit)}
            `;

        // Memory by user
        const userQuery = `
                SELECT
                    user,
                    current_count_used,
                    current_allocated,
                    current_avg_alloc,
                    current_max_alloc,
                    total_allocated
                FROM sys.memory_by_user_by_current_bytes
                ORDER BY current_allocated DESC
                LIMIT ${String(limit)}
            `;

        const [globalStats, userStats] = await Promise.all([
          adapter.executeQuery(globalQuery),
          adapter.executeQuery(userQuery),
        ]);

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
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
