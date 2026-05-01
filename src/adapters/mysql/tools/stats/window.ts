/**
 * MySQL Statistics Tools - Window Functions
 *
 * SQL window function tools: row_number, rank, lag/lead, running_total, moving_avg, ntile.
 * 6 tools total.
 */

import { z, ZodError } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  formatMysqlError,
  withTokenEstimate,
} from "../core/error-helpers.js";

// =============================================================================
// Schemas
// =============================================================================

export const StatsRowNumberSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z.unknown().optional().describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  limit: z.unknown().optional().describe("Maximum rows to return (default: 20)"),
});

export const StatsRowNumberSchema = z.object({
  table: z.string().min(1, "table is required"),
  orderBy: z.string().min(1, "orderBy is required"),
  partitionBy: z.string().optional(),
  selectColumns: z
    .array(z.string())
    .optional(),
  where: z.string().optional(),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20),
});

export const StatsRankSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  orderBy: z.string().optional().describe("Column(s) to order by (determines rank)"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z.unknown().optional().describe("Columns to include in result"),
  method: z.unknown().optional().describe("Rank function type (default: rank)"),
  where: z.string().optional().describe("Filter condition"),
  limit: z.unknown().optional().describe("Maximum rows to return (default: 20)"),
});

export const StatsRankSchema = z.object({
  table: z.string().min(1, "table is required"),
  orderBy: z.string().min(1, "orderBy is required"),
  partitionBy: z.string().optional(),
  selectColumns: z
    .array(z.string())
    .optional(),
  method: z
    .enum(["rank", "dense_rank", "percent_rank"])
    .default("rank"),
  where: z.string().optional(),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20),
});

export const StatsLagLeadSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Column to get lag/lead value from"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  direction: z.unknown().optional().describe("LAG (previous row) or LEAD (next row)"),
  offset: z.unknown().optional().describe("Number of rows to look back/ahead (default: 1)"),
  defaultValue: z.string().optional().describe("Default value if no row exists"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z.unknown().optional().describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  limit: z.unknown().optional().describe("Maximum rows to return (default: 20)"),
});

export const StatsLagLeadSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  orderBy: z.string().min(1, "orderBy is required"),
  direction: z
    .enum(["lag", "lead"]),
  offset: z
    .number()
    .min(1)
    .default(1),
  defaultValue: z
    .string()
    .optional(),
  partitionBy: z.string().optional(),
  selectColumns: z
    .array(z.string())
    .optional(),
  where: z.string().optional(),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20),
});

export const StatsRunningTotalSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Numeric column to sum"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  partitionBy: z.string().optional().describe("Reset running total for each partition"),
  selectColumns: z.unknown().optional().describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  limit: z.unknown().optional().describe("Maximum rows to return (default: 20)"),
});

export const StatsRunningTotalSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  orderBy: z.string().min(1, "orderBy is required"),
  partitionBy: z
    .string()
    .optional(),
  selectColumns: z
    .array(z.string())
    .optional(),
  where: z.string().optional(),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20),
});

export const StatsMovingAvgSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  column: z.string().optional().describe("Numeric column to average"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  windowSize: z.unknown().optional().describe("Number of rows in the moving window"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z.unknown().optional().describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  limit: z.unknown().optional().describe("Maximum rows to return (default: 20)"),
});

export const StatsMovingAvgSchema = z.object({
  table: z.string().min(1, "table is required"),
  column: z.string().min(1, "column is required"),
  orderBy: z.string().min(1, "orderBy is required"),
  windowSize: z
    .number()
    .min(1)
    .default(3),
  partitionBy: z.string().optional(),
  selectColumns: z
    .array(z.string())
    .optional(),
  where: z.string().optional(),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20),
});

export const StatsNtileSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  orderBy: z.string().optional().describe("Column(s) to order by"),
  buckets: z.unknown().optional().describe("Number of buckets (e.g., 4 for quartiles)"),
  partitionBy: z.string().optional().describe("Column(s) to partition by"),
  selectColumns: z.unknown().optional().describe("Columns to include in result"),
  where: z.string().optional().describe("Filter condition"),
  limit: z.unknown().optional().describe("Maximum rows to return (default: 20)"),
});

export const StatsNtileSchema = z.object({
  table: z.string().min(1, "table is required"),
  orderBy: z.string().min(1, "orderBy is required"),
  buckets: z
    .number()
    .min(1)
    .default(4),
  partitionBy: z.string().optional(),
  selectColumns: z
    .array(z.string())
    .optional(),
  where: z.string().optional(),
  limit: z
    .number()
    .min(1)
    .max(1000)
    .default(20),
});

// =============================================================================
// Helpers
// =============================================================================

function selectList(
  selectColumns: string[] | undefined,
  windowExpr: string,
  windowAlias: string,
): string {
  const cols =
    selectColumns && selectColumns.length > 0
      ? selectColumns.map((c) => `\`${c}\``).join(", ")
      : "*";
  return `${cols}, ${windowExpr} AS \`${windowAlias}\``;
}

function partitionClause(partitionBy?: string): string {
  if (!partitionBy) return "";
  return `PARTITION BY \`${partitionBy}\``;
}

function whereClause(where?: string): string {
  if (!where) return "";
  return `WHERE ${where}`;
}

// =============================================================================
// ROW_NUMBER
// =============================================================================

export function createStatsRowNumberTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_row_number",
    description:
      "Assign sequential row numbers within an ordered result set. Use partitionBy to restart numbering per group.",
    group: "stats",
    inputSchema: StatsRowNumberSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsRowNumberSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }

        const partition = partitionClause(parsed.partitionBy);
        // MySQL 8.0+ syntax
        const windowExpr = `ROW_NUMBER() OVER(${partition} ORDER BY \`${parsed.orderBy}\`)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, "row_number")}
          FROM \`${parsed.table}\`
          ${whereClause(parsed.where)}
          ORDER BY \`${parsed.orderBy}\`
          LIMIT ${String(parsed.limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          rowCount: rows.length,
          rows,
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}

// =============================================================================
// RANK / DENSE_RANK / PERCENT_RANK
// =============================================================================

export function createStatsRankTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_rank",
    description:
      "Assign rank within an ordered result set. Supports rank (gaps), dense_rank (no gaps), and percent_rank (0-1). Use partitionBy to rank within groups.",
    group: "stats",
    inputSchema: StatsRankSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsRankSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }

        const rankType = parsed.method;
        const partition = partitionClause(parsed.partitionBy);
        const fnName = rankType.toUpperCase();

        const windowExpr = `${fnName}() OVER(${partition} ORDER BY \`${parsed.orderBy}\`)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, rankType)}
          FROM \`${parsed.table}\`
          ${whereClause(parsed.where)}
          ORDER BY \`${parsed.orderBy}\`
          LIMIT ${String(parsed.limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          rankType,
          rowCount: rows.length,
          rows,
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}

// =============================================================================
// LAG / LEAD
// =============================================================================

export function createStatsLagLeadTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_lag_lead",
    description:
      "Access data from previous (LAG) or next (LEAD) rows in an ordered set. Useful for comparisons, deltas, and change detection.",
    group: "stats",
    inputSchema: StatsLagLeadSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsLagLeadSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.column)) {
          return withTokenEstimate({ success: false, error: "Invalid column name" });
        }

        const partition = partitionClause(parsed.partitionBy);
        const fnName = parsed.direction.toUpperCase();
        const defaultArg =
          parsed.defaultValue !== undefined
            ? `, '${parsed.defaultValue.replace(/'/g, "''")}'`
            : "";

        const windowExpr = `${fnName}(\`${parsed.column}\`, ${String(parsed.offset)}${defaultArg}) OVER(${partition} ORDER BY \`${parsed.orderBy}\`)`;
        const alias = `${parsed.direction}_value`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, alias)}
          FROM \`${parsed.table}\`
          ${whereClause(parsed.where)}
          ORDER BY \`${parsed.orderBy}\`
          LIMIT ${String(parsed.limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          direction: parsed.direction,
          offset: parsed.offset,
          rowCount: rows.length,
          rows,
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}

// =============================================================================
// RUNNING TOTAL
// =============================================================================

export function createStatsRunningTotalTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_running_total",
    description:
      "Calculate cumulative running total (SUM OVER) for a numeric column. Use partitionBy to reset total per group.",
    group: "stats",
    inputSchema: StatsRunningTotalSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsRunningTotalSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.column)) {
          return withTokenEstimate({ success: false, error: "Invalid column name" });
        }

        const partition = partitionClause(parsed.partitionBy);
        const windowExpr = `SUM(\`${parsed.column}\`) OVER(${partition} ORDER BY \`${parsed.orderBy}\` ROWS UNBOUNDED PRECEDING)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, "running_total")}
          FROM \`${parsed.table}\`
          ${whereClause(parsed.where)}
          ORDER BY \`${parsed.orderBy}\`
          LIMIT ${String(parsed.limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          valueColumn: parsed.column,
          rowCount: rows.length,
          rows,
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}

// =============================================================================
// MOVING AVERAGE
// =============================================================================

export function createStatsMovingAvgTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_moving_avg",
    description:
      "Calculate moving average (AVG OVER sliding window) for a numeric column. Specify windowSize for the number of preceding rows to include.",
    group: "stats",
    inputSchema: StatsMovingAvgSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsMovingAvgSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.column)) {
          return withTokenEstimate({ success: false, error: "Invalid column name" });
        }

        const windowSize = parsed.windowSize;
        const partition = partitionClause(parsed.partitionBy);
        const preceding = windowSize - 1;
        const windowExpr = `AVG(\`${parsed.column}\`) OVER(${partition} ORDER BY \`${parsed.orderBy}\` ROWS BETWEEN ${String(preceding)} PRECEDING AND CURRENT ROW)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, "moving_avg")}
          FROM \`${parsed.table}\`
          ${whereClause(parsed.where)}
          ORDER BY \`${parsed.orderBy}\`
          LIMIT ${String(parsed.limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          valueColumn: parsed.column,
          windowSize,
          rowCount: rows.length,
          rows,
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}

// =============================================================================
// NTILE
// =============================================================================

export function createStatsNtileTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_ntile",
    description:
      "Divide ordered rows into N equal buckets (e.g., quartiles with buckets=4). Returns bucket assignment per row.",
    group: "stats",
    inputSchema: StatsNtileSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsNtileSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({ success: false, error: "Invalid table name" });
        }

        const buckets = parsed.buckets;
        const partition = partitionClause(parsed.partitionBy);
        const windowExpr = `NTILE(${String(buckets)}) OVER(${partition} ORDER BY \`${parsed.orderBy}\`)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, "ntile")}
          FROM \`${parsed.table}\`
          ${whereClause(parsed.where)}
          ORDER BY \`${parsed.orderBy}\`
          LIMIT ${String(parsed.limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          buckets,
          rowCount: rows.length,
          rows,
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}
