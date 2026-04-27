/**
 * MySQL Admin Tools - Table Maintenance
 *
 * Tools for table maintenance operations.
 * 6 tools: optimize, analyze, check, repair, flush, kill.
 */

import { ZodError } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  OptimizeTableSchema,
  OptimizeTableSchemaBase,
  AnalyzeTableSchema,
  AnalyzeTableSchemaBase,
  CheckTableSchema,
  CheckTableSchemaBase,
  RepairTableSchema,
  RepairTableSchemaBase,
  FlushTablesSchema,
  FlushTablesSchemaBase,
  KillQuerySchema,
  KillQuerySchemaBase,
} from "../../schemas/index.js";

import { ErrorCategory } from "../../../../types/modules/error-types.js";
import type { ErrorResponse } from "../../../../types/modules/error-types.js";

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null;
}

function extractMaintenanceError(
  rows: unknown[] | undefined,
): ErrorResponse | null {
  if (!rows || rows.length === 0) return null;
  const errorRow = rows.find((r: unknown) => {
    if (isRecord(r) && typeof r["Msg_type"] === "string") {
      return r["Msg_type"].toLowerCase() === "error";
    }
    return false;
  });
  if (errorRow !== undefined && isRecord(errorRow)) {
    const errorMsg =
      typeof errorRow["Msg_text"] === "string"
        ? errorRow["Msg_text"]
        : "Maintenance operation failed";
    return {
      success: false,
      error: errorMsg,
      code: "MAINTENANCE_ERROR",
      category: ErrorCategory.QUERY,
      suggestion: undefined,
      recoverable: false,
      details: undefined,
    };
  }
  return null;
}

export function createOptimizeTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_optimize_table",
    title: "MySQL Optimize Table",
    description: "Optimize tables to reclaim unused space and defragment data.",
    group: "admin",
    inputSchema: OptimizeTableSchemaBase,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables } = OptimizeTableSchema.parse(params);
        const tableList = tables.map((t) => `\`${t}\``).join(", ");
        const result = await adapter.rawQuery(`OPTIMIZE TABLE ${tableList}`);
        const rows = result.rows ?? [];
        const error = extractMaintenanceError(rows);
        if (error) return error;
        return { success: true, results: rows, rowCount: rows.length };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createAnalyzeTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_analyze_table",
    title: "MySQL Analyze Table",
    description:
      "Analyze tables to update index statistics for the query optimizer.",
    group: "admin",
    inputSchema: AnalyzeTableSchemaBase,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables } = AnalyzeTableSchema.parse(params);
        const tableList = tables.map((t) => `\`${t}\``).join(", ");
        const result = await adapter.rawQuery(`ANALYZE TABLE ${tableList}`);
        const rows = result.rows ?? [];
        const error = extractMaintenanceError(rows);
        if (error) return error;
        return { success: true, results: rows, rowCount: rows.length };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createCheckTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_check_table",
    title: "MySQL Check Table",
    description: "Check tables for errors.",
    group: "admin",
    inputSchema: CheckTableSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables, option } = CheckTableSchema.parse(params);
        const tableList = tables.map((t) => `\`${t}\``).join(", ");
        const optionClause = option ? ` ${option}` : "";
        // Use rawQuery - CHECK TABLE not supported in prepared statement protocol
        const result = await adapter.rawQuery(
          `CHECK TABLE ${tableList}${optionClause}`,
        );
        const rows = result.rows ?? [];
        const error = extractMaintenanceError(rows);
        if (error) return error;
        return {
          success: true,
          results: rows,
          rowCount: rows.length,
        };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createRepairTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_repair_table",
    title: "MySQL Repair Table",
    description: "Repair corrupted tables (MyISAM only).",
    group: "admin",
    inputSchema: RepairTableSchemaBase,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables, quick } = RepairTableSchema.parse(params);
        const tableList = tables.map((t) => `\`${t}\``).join(", ");
        const quickClause = quick ? " QUICK" : "";
        const result = await adapter.rawQuery(
          `REPAIR TABLE ${tableList}${quickClause}`,
        );
        const rows = result.rows ?? [];
        const error = extractMaintenanceError(rows);
        if (error) return error;
        return { success: true, results: rows, rowCount: rows.length };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createFlushTablesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_flush_tables",
    title: "MySQL Flush Tables",
    description: "Flush tables to ensure data is written to disk.",
    group: "admin",
    inputSchema: FlushTablesSchemaBase,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables } = FlushTablesSchema.parse(params);

        if (tables && tables.length > 0) {
          // Pre-check table existence since FLUSH TABLES silently succeeds for nonexistent tables
          const placeholders = tables.map(() => "?").join(", ");
          const checkResult = await adapter.executeReadQuery(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
            tables,
          );
          const foundTables = new Set(
            (checkResult.rows ?? []).map(
              (r: Record<string, unknown>) => r["TABLE_NAME"] as string,
            ),
          );
          const notFound = tables.filter((t) => !foundTables.has(t));

          if (notFound.length > 0) {
            // Flush valid tables before reporting missing ones
            const validTables = tables.filter((t) => foundTables.has(t));
            if (validTables.length > 0) {
              const validList = validTables.map((t) => `\`${t}\``).join(", ");
              await adapter.executeQuery(`FLUSH TABLES ${validList}`);
            }
            return {
              success: false,
              error: `Tables not found: ${notFound.join(", ")}`,
              code: "MAINTENANCE_ERROR",
              category: ErrorCategory.RESOURCE,
              suggestion: undefined,
              recoverable: false,
              details: {
                notFound,
                flushed: validTables,
              },
            };
          }

          const tableList = tables.map((t) => `\`${t}\``).join(", ");
          await adapter.executeQuery(`FLUSH TABLES ${tableList}`);
        } else {
          await adapter.executeQuery("FLUSH TABLES");
        }

        return { success: true };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createKillQueryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_kill_query",
    title: "MySQL Kill Query",
    description: "Kill a running query or connection.",
    group: "admin",
    inputSchema: KillQuerySchemaBase,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { processId, connection } = KillQuerySchema.parse(params);
        const killType = connection ? "CONNECTION" : "QUERY";
        await adapter.executeQuery(`KILL ${killType} ${processId}`);
        return { success: true, killed: processId, type: killType };
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Unknown thread id")) {
          return {
            success: false,
            error: `Process ID ${/\d+/.exec(message)?.[0] ?? "unknown"} not found`,
            code: "KILL_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: undefined,
          };
        }
        return {
          success: false,
          error: message,
          code: "KILL_ERROR",
          category: ErrorCategory.QUERY,
          suggestion: undefined,
          recoverable: false,
          details: undefined,
        };
      }
    },
  };
}
