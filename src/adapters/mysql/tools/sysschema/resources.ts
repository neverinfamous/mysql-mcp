/**
 * MySQL sys Schema Tools - Resource Monitoring
 *
 * Tools for monitoring database resources and objects.
 * 3 tools: schema_stats, innodb_lock_waits, memory_summary.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Zod Schemas
// =============================================================================

const LimitSchema = z.object({
  limit: z.number().default(10).describe("Maximum number of results to return"),
});

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
    inputSchema: z.object({
      schema: z
        .string()
        .optional()
        .describe("Schema name (defaults to current database)"),
      limit: z.number().default(10).describe("Maximum number of results"),
    }),
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { schema, limit } = z
        .object({
          schema: z.string().optional(),
          limit: z.number().default(10),
        })
        .parse(params);

      // P154: Schema existence check when explicitly provided
      if (schema) {
        const schemaCheck = await adapter.executeQuery(
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
          [schema],
        );
        if (!schemaCheck.rows || schemaCheck.rows.length === 0) {
          return { exists: false, schema };
        }
      }

      // Resolve actual database name for response
      let resolvedSchema = schema;
      if (!resolvedSchema) {
        const dbResult = await adapter.executeQuery("SELECT DATABASE() as db");
        const rows = dbResult.rows ?? [];
        const dbRow = rows[0] as Record<string, unknown> | undefined;
        resolvedSchema = (dbRow?.["db"] as string) ?? "unknown";
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
                    delete_latency,
                    io_read_requests,
                    io_read,
                    io_read_latency,
                    io_write_requests,
                    io_write,
                    io_write_latency
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

      return {
        tableStatistics: tableStats.rows ?? [],
        indexStatistics: indexStats.rows ?? [],
        autoIncrementStatus: autoIncStats.rows ?? [],
        schemaName: resolvedSchema,
      };
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
    inputSchema: LimitSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
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

      const result = await adapter.executeQuery(query);
      return {
        lockWaits: result.rows,
        count: result.rows?.length ?? 0,
        hasContention: (result.rows?.length ?? 0) > 0,
      };
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
    inputSchema: LimitSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
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

      return {
        globalMemory: globalStats.rows ?? [],
        memoryByUser: userStats.rows ?? [],
        globalMemoryCount: (globalStats.rows ?? []).length,
        memoryByUserCount: (userStats.rows ?? []).length,
      };
    },
  };
}
