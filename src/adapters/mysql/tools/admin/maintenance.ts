/**
 * MySQL Admin Tools - Table Maintenance
 *
 * Tools for table maintenance operations.
 * 6 tools: optimize, analyze, check, repair, flush, kill.
 */

import { ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
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
  OptimizeTableOutputSchema,
  AnalyzeTableOutputSchema,
  CheckTableOutputSchema,
  RepairTableOutputSchema,
  FlushTablesOutputSchema,
  KillQueryOutputSchema,
} from "../../schemas/index.js";

import { ErrorCategory } from "../../../../types/modules/error-types.js";
import {
  IDEMPOTENT,
  READ_ONLY,
  DESTRUCTIVE,
} from "../../../../utils/annotations.js";
import { progressFactory } from "../../../../progress/index.js";
import { escapeQualifiedTable, parseQualifiedTable } from "../../../../utils/validators.js";

export function createOptimizeTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_optimize_table",
    title: "MySQL Optimize Table",
    description: "Optimize tables to reclaim unused space and defragment data.",
    group: "admin",
    inputSchema: OptimizeTableSchemaBase,
    outputSchema: OptimizeTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: IDEMPOTENT,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables, local } = OptimizeTableSchema.parse(params);
        
        // Pre-check table existence
        const checkPromises = tables.map(async (t) => {
          const parsed = parseQualifiedTable(t);
          const schema = parsed.schema;
          const tableName = parsed.table;
          const query = schema !== undefined
            ? `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`
            : `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`;
          const args = schema !== undefined ? [schema, tableName] : [tableName];
          const res = await adapter.executeReadQuery(query, args);
          return { table: t, found: (res.rows ?? []).length > 0 };
        });
        const results = await Promise.all(checkPromises);
        const notFound = results.filter((r) => !r.found).map((r) => r.table);
        if (notFound.length > 0) {
          return withTokenEstimate({
            success: false,
            error: `Tables not found: ${notFound.join(", ")}`,
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { notFound },
          });
        }

        const tableList = tables.map(escapeQualifiedTable).join(", ");

        const reporter = progressFactory.create(_context.progressToken);
        reporter?.start(1, `Optimizing tables: ${tables.join(", ")}...`);

        const modifier = local ? "LOCAL " : "";
        const result = await adapter.rawQuery(`OPTIMIZE ${modifier}TABLE ${tableList}`);

        reporter?.complete();
        const rows = result.rows ?? [];
        const errorRow = rows.find(
          (r: Record<string, unknown>) =>
            String(r["Msg_type"]).toLowerCase() === "error",
        );
        if (errorRow) {
          return withTokenEstimate({
            success: false,
            error: String(errorRow["Msg_text"]),
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { results: rows },
          });
        }
        return withTokenEstimate({
          success: true,
          data: { results: rows, rowCount: rows.length },
        });
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
    outputSchema: AnalyzeTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: IDEMPOTENT,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables, local, update_histograms } = AnalyzeTableSchema.parse(params);
        
        // Pre-check table existence
        const checkPromises = tables.map(async (t) => {
          const parsed = parseQualifiedTable(t);
          const schema = parsed.schema;
          const tableName = parsed.table;
          const query = schema !== undefined
            ? `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`
            : `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`;
          const args = schema !== undefined ? [schema, tableName] : [tableName];
          const res = await adapter.executeReadQuery(query, args);
          return { table: t, found: (res.rows ?? []).length > 0 };
        });
        const results = await Promise.all(checkPromises);
        const notFound = results.filter((r) => !r.found).map((r) => r.table);
        if (notFound.length > 0) {
          return withTokenEstimate({
            success: false,
            error: `Tables not found: ${notFound.join(", ")}`,
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { notFound },
          });
        }

        const rows: Record<string, unknown>[] = [];
        
        const reporter = progressFactory.create(_context.progressToken);
        const modifier = local ? "LOCAL " : "";
        for (let i = 0; i < tables.length; i++) {
          const t = tables[i];
          if (!t) continue;
          reporter?.progress(i, tables.length, `Analyzing table: ${t}`);
          let query = `ANALYZE ${modifier}TABLE ${escapeQualifiedTable(t)}`;
          if (update_histograms) {
             query += ` UPDATE HISTOGRAMS ON ${escapeQualifiedTable(t)}.*`;
          }
          const result = await adapter.rawQuery(query).catch(async (e: unknown) => {
            if (update_histograms) {
               // Fallback if the simplistic histogram syntax is rejected
               return await adapter.rawQuery(`ANALYZE ${modifier}TABLE ${escapeQualifiedTable(t)}`);
            }
            throw e;
          });
          if (result.rows) {
            rows.push(...result.rows);
          }
        }
        reporter?.complete();

        const errorRow = rows.find(
          (r: Record<string, unknown>) =>
            String(r["Msg_type"]).toLowerCase() === "error",
        );
        if (errorRow) {
          return withTokenEstimate({
            success: false,
            error: String(errorRow["Msg_text"]),
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { results: rows },
          });
        }
        return withTokenEstimate({
          success: true,
          data: { results: rows, rowCount: rows.length },
        });
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
    outputSchema: CheckTableOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables, option } = CheckTableSchema.parse(params);
        
        // Pre-check table existence
        const checkPromises = tables.map(async (t) => {
          const parsed = parseQualifiedTable(t);
          const schema = parsed.schema;
          const tableName = parsed.table;
          const query = schema !== undefined
            ? `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`
            : `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`;
          const args = schema !== undefined ? [schema, tableName] : [tableName];
          const res = await adapter.executeReadQuery(query, args);
          return { table: t, found: (res.rows ?? []).length > 0 };
        });
        const results = await Promise.all(checkPromises);
        const notFound = results.filter((r) => !r.found).map((r) => r.table);
        if (notFound.length > 0) {
          return withTokenEstimate({
            success: false,
            error: `Tables not found: ${notFound.join(", ")}`,
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { notFound },
          });
        }

        const optionClause = option ? ` ${option}` : "";
        const rows: Record<string, unknown>[] = [];

        const reporter = progressFactory.create(_context.progressToken);
        for (let i = 0; i < tables.length; i++) {
          const t = tables[i];
          if (!t) continue;
          reporter?.progress(i, tables.length, `Checking table: ${t}`);
          // Use rawQuery - CHECK TABLE not supported in prepared statement protocol
          const result = await adapter.rawQuery(`CHECK TABLE ${escapeQualifiedTable(t)}${optionClause}`);
          if (result.rows) {
            rows.push(...result.rows);
          }
        }
        reporter?.complete();

        const errorRow = rows.find(
          (r: Record<string, unknown>) =>
            String(r["Msg_type"]).toLowerCase() === "error",
        );
        if (errorRow) {
          return withTokenEstimate({
            success: false,
            error: String(errorRow["Msg_text"]),
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { results: rows },
          });
        }
        return withTokenEstimate({
          success: true,
          data: {
            results: rows,
            rowCount: rows.length,
          },
        });
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
    outputSchema: RepairTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: IDEMPOTENT,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables, quick } = RepairTableSchema.parse(params);
        
        // Pre-check table existence
        const checkPromises = tables.map(async (t) => {
          const parsed = parseQualifiedTable(t);
          const schema = parsed.schema;
          const tableName = parsed.table;
          const query = schema !== undefined
            ? `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`
            : `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`;
          const args = schema !== undefined ? [schema, tableName] : [tableName];
          const res = await adapter.executeReadQuery(query, args);
          return { table: t, found: (res.rows ?? []).length > 0 };
        });
        const results = await Promise.all(checkPromises);
        const notFound = results.filter((r) => !r.found).map((r) => r.table);
        if (notFound.length > 0) {
          return withTokenEstimate({
            success: false,
            error: `Tables not found: ${notFound.join(", ")}`,
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { notFound },
          });
        }

        const tableList = tables.map(escapeQualifiedTable).join(", ");
        const quickClause = quick ? " QUICK" : "";

        const reporter = progressFactory.create(_context.progressToken);
        reporter?.start(1, `Repairing tables: ${tables.join(", ")}...`);

        const result = await adapter.rawQuery(
          `REPAIR TABLE ${tableList}${quickClause}`,
        );

        reporter?.complete();
        const rows = result.rows ?? [];
        const errorRow = rows.find(
          (r: Record<string, unknown>) =>
            String(r["Msg_type"]).toLowerCase() === "error",
        );
        if (errorRow) {
          return withTokenEstimate({
            success: false,
            error: String(errorRow["Msg_text"]),
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { results: rows },
          });
        }
        return withTokenEstimate({
          success: true,
          data: { results: rows, rowCount: rows.length },
        });
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
    outputSchema: FlushTablesOutputSchema,
    requiredScopes: ["admin"],
    annotations: IDEMPOTENT,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { tables, withReadLock, forExport } = FlushTablesSchema.parse(params);
        const lockSuffix = withReadLock ? " WITH READ LOCK" : forExport ? " FOR EXPORT" : "";

        if (tables && tables.length > 0) {
          // Pre-check table existence since FLUSH TABLES silently succeeds for nonexistent tables
          const checkPromises = tables.map(async (t) => {
            const parsed = parseQualifiedTable(t);
            const schema = parsed.schema;
            const tableName = parsed.table;
            
            const query = schema !== undefined
              ? `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`
              : `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`;
            const args = schema !== undefined ? [schema, tableName] : [tableName];
            
            const res = await adapter.executeReadQuery(query, args);
            return { table: t, found: (res.rows ?? []).length > 0 };
          });
          
          const results = await Promise.all(checkPromises);
          const foundTables = new Set(results.filter(r => r.found).map(r => r.table));
          const notFound = results.filter(r => !r.found).map(r => r.table);

          if (notFound.length > 0) {
            // Flush valid tables before reporting missing ones
            const validTables = tables.filter((t) => foundTables.has(t));
            if (validTables.length > 0) {
              const validList = validTables.map(escapeQualifiedTable).join(", ");
              await adapter.executeQuery(`FLUSH TABLES ${validList}${lockSuffix}`);
            }
            return withTokenEstimate({
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
            });
          }

          const tableList = tables.map(escapeQualifiedTable).join(", ");
          await adapter.executeQuery(`FLUSH TABLES ${tableList}${lockSuffix}`);
        } else {
          await adapter.executeQuery(`FLUSH TABLES${lockSuffix}`);
        }

        return withTokenEstimate({ success: true, data: {} });
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
    outputSchema: KillQueryOutputSchema,
    requiredScopes: ["admin"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { processId, connection } = KillQuerySchema.parse(params);
        const killType = connection ? "CONNECTION" : "QUERY";
        await adapter.executeQuery(`KILL ${killType} ${processId}`);
        return withTokenEstimate({
          success: true,
          data: { killed: processId, type: killType },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Unknown thread id")) {
          return withTokenEstimate({
            success: false,
            error: `Process ID ${/\d+/.exec(message)?.[0] ?? "unknown"} not found`,
            code: "KILL_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: undefined,
          });
        }
        if (message.includes("You are not owner of thread")) {
          return withTokenEstimate({
            success: false,
            error: `Permission denied: ${message}`,
            code: "KILL_ERROR",
            category: ErrorCategory.PERMISSION,
            suggestion: "Ensure you have the PROCESS or SUPER privilege, or own the thread you are trying to kill.",
            recoverable: false,
            details: undefined,
          });
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
