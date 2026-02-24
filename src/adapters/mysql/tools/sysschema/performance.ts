/**
 * MySQL sys Schema Tools - Performance Analysis
 *
 * Tools for analyzing statement execution, wait events, and I/O.
 * 3 tools: statement_summary, wait_summary, io_summary.
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

// =============================================================================
// Helpers
// =============================================================================

/** Extract human-readable messages from a ZodError instead of raw JSON array */
function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

// =============================================================================
// Zod Schemas
// =============================================================================

const VALID_ORDER_BY = [
  "total_latency",
  "exec_count",
  "avg_latency",
  "rows_sent",
  "rows_examined",
] as const;

const StatementSummarySchema = z.object({
  orderBy: z.string().default("total_latency").describe("Order results by"),
  limit: z.number().default(20).describe("Maximum number of results"),
});

const VALID_WAIT_TYPES = [
  "global",
  "by_host",
  "by_user",
  "by_instance",
] as const;

const WaitSummarySchema = z.object({
  type: z.string().default("global").describe("Type of wait summary"),
  limit: z.number().default(20).describe("Maximum number of results"),
});

const VALID_IO_TYPES = ["file", "table", "global"] as const;

const IOSummarySchema = z.object({
  type: z.string().default("table").describe("Type of I/O summary"),
  limit: z.number().default(20).describe("Maximum number of results"),
});

/**
 * Get statement execution summary
 */
export function createSysStatementSummaryTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_sys_statement_summary",
    title: "MySQL Statement Summary",
    description:
      "Get statement execution statistics including latency and row counts from sys schema.",
    group: "sysschema",
    inputSchema: StatementSummarySchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { orderBy, limit } = StatementSummarySchema.parse(params);

        if (
          !VALID_ORDER_BY.includes(orderBy as (typeof VALID_ORDER_BY)[number])
        ) {
          return {
            success: false,
            error: `Invalid orderBy: '${orderBy}' — expected one of: ${VALID_ORDER_BY.join(", ")}`,
          };
        }

        const query = `
                SELECT 
                    query,
                    db,
                    exec_count,
                    total_latency,
                    avg_latency,
                    rows_sent,
                    rows_sent_avg,
                    rows_examined,
                    rows_examined_avg,
                    full_scan
                FROM sys.statement_analysis
                ORDER BY ${orderBy} DESC
                LIMIT ${String(limit)}
            `;

        const result = await adapter.executeQuery(query);
        return {
          statements: result.rows,
          orderedBy: orderBy,
          count: result.rows?.length ?? 0,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    },
  };
}

/**
 * Get wait event summary
 */
export function createSysWaitSummaryTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_sys_wait_summary",
    title: "MySQL Wait Summary",
    description:
      "Get wait event summary for performance analysis from sys schema.",
    group: "sysschema",
    inputSchema: WaitSummarySchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { type, limit } = WaitSummarySchema.parse(params);

        if (
          !VALID_WAIT_TYPES.includes(type as (typeof VALID_WAIT_TYPES)[number])
        ) {
          return {
            success: false,
            error: `Invalid type: '${type}' — expected one of: ${VALID_WAIT_TYPES.join(", ")}`,
          };
        }

        let query: string;

        switch (type) {
          case "global":
            query = `
                        SELECT 
                            events,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.waits_global_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(limit)}
                    `;
            break;
          case "by_host":
            query = `
                        SELECT 
                            host,
                            event,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.waits_by_host_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(limit)}
                    `;
            break;
          case "by_user":
            query = `
                        SELECT 
                            user,
                            event,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.waits_by_user_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(limit)}
                    `;
            break;
          case "by_instance":
            query = `
                        SELECT 
                            event_name AS event,
                            count_star AS total,
                            FORMAT_PICO_TIME(sum_timer_wait) AS total_latency,
                            FORMAT_PICO_TIME(sum_timer_wait / NULLIF(count_star, 0)) AS avg_latency
                        FROM performance_schema.events_waits_summary_by_instance
                        ORDER BY sum_timer_wait DESC
                        LIMIT ${String(limit)}
                    `;
            break;
          default:
            throw new Error(`Unexpected type: ${type}`);
        }

        const result = await adapter.executeQuery(query);
        return {
          waits: result.rows,
          type,
          count: result.rows?.length ?? 0,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    },
  };
}

/**
 * Get I/O summary
 */
export function createSysIOSummaryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_sys_io_summary",
    title: "MySQL I/O Summary",
    description:
      "Get I/O usage summary by file, table, or global from sys schema.",
    group: "sysschema",
    inputSchema: IOSummarySchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { type, limit } = IOSummarySchema.parse(params);

        if (!VALID_IO_TYPES.includes(type as (typeof VALID_IO_TYPES)[number])) {
          return {
            success: false,
            error: `Invalid type: '${type}' — expected one of: ${VALID_IO_TYPES.join(", ")}`,
          };
        }

        let query: string;

        switch (type) {
          case "file":
            query = `
                        SELECT 
                            file,
                            count_read,
                            total_read,
                            avg_read,
                            count_write,
                            total_written,
                            avg_write,
                            total,
                            write_pct
                        FROM sys.io_global_by_file_by_bytes
                        ORDER BY total DESC
                        LIMIT ${String(limit)}
                    `;
            break;
          case "table":
            query = `
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
                        ORDER BY (fetch_latency + insert_latency + update_latency + delete_latency) DESC
                        LIMIT ${String(limit)}
                    `;
            break;
          case "global":
            query = `
                        SELECT 
                            event_name,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.io_global_by_wait_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(limit)}
                    `;
            break;
          default:
            throw new Error(`Unexpected type: ${type}`);
        }

        const result = await adapter.executeQuery(query);
        return {
          ioStats: result.rows,
          type,
          count: result.rows?.length ?? 0,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
      }
    },
  };
}
