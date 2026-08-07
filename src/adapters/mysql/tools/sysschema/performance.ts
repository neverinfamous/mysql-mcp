/**
 * MySQL sys Schema Tools - Performance Analysis
 *
 * Tools for analyzing statement execution, wait events, and I/O.
 * 3 tools: statement_summary, wait_summary, io_summary.
 */

import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  SysStatementSummaryOutputSchema,
  SysWaitSummaryOutputSchema,
  SysIoSummaryOutputSchema,
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

function formatTime(picoseconds: number | string | null | undefined): string | null {
  if (picoseconds == null) return null;
  const p = Number(picoseconds);
  if (isNaN(p)) return String(picoseconds);
  if (p === 0) return "0 ps";
  if (p < 1000) return `${p.toFixed(2)} ps`;
  if (p < 1000000) return `${(p / 1000).toFixed(2)} ns`;
  if (p < 1000000000) return `${(p / 1000000).toFixed(2)} us`;
  if (p < 1000000000000) return `${(p / 1000000000).toFixed(2)} ms`;
  if (p < 60000000000000) return `${(p / 1000000000000).toFixed(2)} s`;
  if (p < 3600000000000000) return `${(p / 60000000000000).toFixed(2)} min`;
  return `${(p / 3600000000000000).toFixed(2)} h`;
}

function formatBytes(bytes: number | string | null | undefined): string | null {
  if (bytes == null) return null;
  const b = Number(bytes);
  if (isNaN(b)) return String(bytes);
  if (b === 0) return "0 bytes";
  if (b < 1024) return `${b.toFixed(2)} bytes`;
  if (b < 1048576) return `${(b / 1024).toFixed(2)} KiB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(2)} MiB`;
  return `${(b / 1073741824).toFixed(2)} GiB`;
}

// =============================================================================
// Zod Schemas
// =============================================================================

const VALID_ORDER_BY: readonly string[] = [
  "total_latency",
  "exec_count",
  "avg_latency",
  "rows_sent",
  "rows_examined",
];

const StatementSummarySchemaBase = z.object({
  orderBy: z.string().optional().describe("Order results by. Anti-Hallucination: Pass 'orderBy', not 'sort' or 'order'."),
  order: z.string().optional().describe("Alias for orderBy"),
  sort: z.string().optional().describe("Alias for orderBy"),
  sortBy: z.string().optional().describe("Alias for orderBy"),
  sort_by: z.string().optional().describe("Alias for orderBy"),
  order_by: z.string().optional().describe("Alias for orderBy"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
}).loose();

const StatementSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as Record<string, unknown> & { orderBy?: unknown; order?: unknown; sort?: unknown; sortBy?: unknown; sort_by?: unknown; order_by?: unknown; limit?: unknown; max?: unknown; count?: unknown };
    return {
      ...v,
      orderBy: v.orderBy ?? v.order_by ?? v.sortBy ?? v.sort_by ?? v.order ?? v.sort,
      limit: v.limit ?? v.max ?? v.count,
    };
  },
  z.object({
    orderBy: z.string().toLowerCase().default("total_latency"),
    limit: z.coerce.number().int().positive().default(5),
    order: z.any().optional(),
    sort: z.any().optional(),
    sortBy: z.any().optional(),
    sort_by: z.any().optional(),
    order_by: z.any().optional(),
    max: z.any().optional(),
    count: z.any().optional(),
  }).strict()
);

const VALID_WAIT_TYPES: readonly string[] = [
  "global",
  "by_host",
  "by_user",
  "by_instance",
];

const WaitSummarySchemaBase = z.object({
  type: z.string().optional().describe("Type of wait summary. Anti-Hallucination: Valid values are 'global', 'by_host', 'by_user', 'by_instance'."),
  waitType: z.string().optional().describe("Alias for type"),
  wait_type: z.string().optional().describe("Alias for type"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
}).loose();

const WaitSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as Record<string, unknown> & { type?: unknown; waitType?: unknown; wait_type?: unknown; limit?: unknown; max?: unknown; count?: unknown };
    return {
      ...v,
      type: v.type ?? v.waitType ?? v.wait_type,
      limit: v.limit ?? v.max ?? v.count,
    };
  },
  z.object({
    type: z.string().toLowerCase().default("global"),
    limit: z.coerce.number().int().positive().default(5),
    waitType: z.any().optional(),
    wait_type: z.any().optional(),
    max: z.any().optional(),
    count: z.any().optional(),
  }).strict()
);

const VALID_IO_TYPES: readonly string[] = ["file", "table", "global"];

const IOSummarySchemaBase = z.object({
  type: z.string().optional().describe("Type of I/O summary. Anti-Hallucination: Valid values are 'file', 'table', 'global'."),
  ioType: z.string().optional().describe("Alias for type"),
  io_type: z.string().optional().describe("Alias for type"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
}).loose();

const IOSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === undefined || val === null || typeof val !== "object") {
      return val;
    }
    const v = val as Record<string, unknown> & { type?: unknown; ioType?: unknown; io_type?: unknown; limit?: unknown; max?: unknown; count?: unknown };
    return {
      ...v,
      type: v.type ?? v.ioType ?? v.io_type,
      limit: v.limit ?? v.max ?? v.count,
    };
  },
  z.object({
    type: z.string().toLowerCase().default("table"),
    limit: z.coerce.number().int().positive().default(5),
    ioType: z.any().optional(),
    io_type: z.any().optional(),
    max: z.any().optional(),
    count: z.any().optional(),
  }).strict()
);

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
    inputSchema: StatementSummarySchemaBase,
    outputSchema: SysStatementSummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { orderBy, limit } = StatementSummarySchema.parse(params);

        if (
          !VALID_ORDER_BY.includes(orderBy)
        ) {
          return withTokenEstimate({
            success: false,
            error: `Invalid orderBy: '${orderBy}' — expected one of: ${VALID_ORDER_BY.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
          });
        }

        const actualLimit = Math.min(limit, 100);

        const query = `
                (SELECT
                    query,
                    db,
                    exec_count,
                    total_latency,
                    avg_latency,
                    rows_sent,
                    ROUND(rows_sent_avg) AS rows_sent_avg,
                    rows_examined,
                    ROUND(rows_examined_avg) AS rows_examined_avg,
                    full_scan
                FROM sys.x$statement_analysis
                ORDER BY ${orderBy} DESC
                LIMIT ${String(actualLimit)})
            `;

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
              if (key === "total_latency" || key === "avg_latency") {
                cleaned[key] = formatTime(value as string | number);
              } else {
                cleaned[key] = value;
              }
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query);
        return withTokenEstimate({
          success: true,
          data: {
            rows: (result.rows ?? []).map(cleanRow),
            orderedBy: orderBy,
            count: result.rows?.length ?? 0,
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
    inputSchema: WaitSummarySchemaBase,
    outputSchema: SysWaitSummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { type, limit } = WaitSummarySchema.parse(params);

        if (
          !VALID_WAIT_TYPES.includes(type)
        ) {
          return withTokenEstimate({
            success: false,
            error: `Invalid type: '${type}' — expected one of: ${VALID_WAIT_TYPES.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
          });
        }

        const actualLimit = Math.min(limit, 100);

        let query: string;

        switch (type) {
            case "global":
            query = `
                        (SELECT
                            events AS event,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.x$waits_global_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(actualLimit)})
                    `;
            break;
          case "by_host":
            query = `
                        (SELECT
                            host,
                            event,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.x$waits_by_host_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(actualLimit)})
                    `;
            break;
          case "by_user":
            query = `
                        (SELECT
                            user,
                            event,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.x$waits_by_user_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(actualLimit)})
                    `;
            break;
          case "by_instance":
            query = `
                        (SELECT
                            event_name AS event,
                            count_star AS total,
                            sum_timer_wait AS total_latency,
                            (sum_timer_wait / NULLIF(count_star, 0)) AS avg_latency
                        FROM performance_schema.events_waits_summary_by_instance
                        ORDER BY total_latency DESC
                        LIMIT ${String(actualLimit)})
                    `;
            break;
          default:
            throw new Error(`Unexpected type: ${type}`);
        }

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
              if (key === "total_latency" || key === "avg_latency") {
                cleaned[key] = formatTime(value as string | number);
              } else {
                cleaned[key] = value;
              }
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query);
        return withTokenEstimate({
          success: true,
          data: {
            rows: (result.rows ?? []).map(cleanRow),
            type,
            count: result.rows?.length ?? 0,
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
 * Get I/O summary
 */
export function createSysIOSummaryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_sys_io_summary",
    title: "MySQL I/O Summary",
    description:
      "Get I/O usage summary by file, table, or global from sys schema.",
    group: "sysschema",
    inputSchema: IOSummarySchemaBase,
    outputSchema: SysIoSummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { type, limit } = IOSummarySchema.parse(params);

        if (!VALID_IO_TYPES.includes(type)) {
          return withTokenEstimate({
            success: false,
            error: `Invalid type: '${type}' — expected one of: ${VALID_IO_TYPES.join(", ")}`,
            code: "VALIDATION_ERROR",
            category: "validation",
          });
        }

        const actualLimit = Math.min(limit, 100);

        let query: string;

        switch (type) {
          case "file":
            query = `
                        (SELECT
                            file,
                            count_read,
                            total_read,
                            avg_read,
                            count_write,
                            total_written,
                            avg_write,
                            total,
                            write_pct
                        FROM sys.x$io_global_by_file_by_bytes
                        ORDER BY total DESC
                        LIMIT ${String(actualLimit)})
                    `;
            break;
          case "table":
            query = `
                        (SELECT
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
                        FROM sys.x$schema_table_statistics
                        ORDER BY (fetch_latency + insert_latency + update_latency + delete_latency) DESC
                        LIMIT ${String(actualLimit)})
                    `;
            break;
          case "global":
            query = `
                        (SELECT
                            event_name,
                            total,
                            total_latency,
                            avg_latency
                        FROM sys.x$io_global_by_wait_by_latency
                        ORDER BY total_latency DESC
                        LIMIT ${String(actualLimit)})
                    `;
            break;
          default:
            throw new Error(`Unexpected type: ${type}`);
        }

        const cleanRow = (row: Record<string, unknown>): Record<string, unknown> => {
          const cleaned: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== 0 && value !== "0" && value !== "  0 ps" && value !== "   0 bytes" && value !== "" && value !== null) {
              if (key.endsWith("_latency")) {
                cleaned[key] = formatTime(value as string | number);
              } else if (key === "total_read" || key === "avg_read" || key === "total_written" || key === "avg_write" || (type === "file" && key === "total")) {
                cleaned[key] = formatBytes(value as string | number);
              } else {
                cleaned[key] = value;
              }
            }
          }
          return cleaned;
        };

        const result = await adapter.executeQuery(query);
        return withTokenEstimate({
          success: true,
          data: {
            rows: (result.rows ?? []).map(cleanRow),
            type,
            count: result.rows?.length ?? 0,
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
