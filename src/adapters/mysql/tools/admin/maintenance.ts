/**
 * MySQL Admin Tools - Table Maintenance
 *
 * Tools for table maintenance operations.
 * 6 tools: optimize, analyze, check, repair, flush, kill.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
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
  FlushTablesSchema,
  FlushTablesSchemaBase,
  KillQuerySchema,
} from "../../types.js";
import { z } from "zod";

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
      const { tables } = OptimizeTableSchema.parse(params);
      const tableList = tables.map((t) => `\`${t}\``).join(", ");
      const result = await adapter.executeQuery(`OPTIMIZE TABLE ${tableList}`);
      return { results: result.rows, rowCount: result.rows?.length ?? 0 };
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
      const { tables } = AnalyzeTableSchema.parse(params);
      const tableList = tables.map((t) => `\`${t}\``).join(", ");
      const result = await adapter.executeQuery(`ANALYZE TABLE ${tableList}`);
      return { results: result.rows, rowCount: result.rows?.length ?? 0 };
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
      const { tables, option } = CheckTableSchema.parse(params);
      const tableList = tables.map((t) => `\`${t}\``).join(", ");
      const optionClause = option ? ` ${option}` : "";
      // Use rawQuery - CHECK TABLE not supported in prepared statement protocol
      const result = await adapter.rawQuery(
        `CHECK TABLE ${tableList}${optionClause}`,
      );
      return {
        results: result.rows ?? [],
        rowCount: result.rows?.length ?? 0,
      };
    },
  };
}

export function createRepairTableTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    tables: z.array(z.string()),
    quick: z.boolean().optional().default(false),
  });

  return {
    name: "mysql_repair_table",
    title: "MySQL Repair Table",
    description: "Repair corrupted tables (MyISAM only).",
    group: "admin",
    inputSchema: schema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { tables, quick } = schema.parse(params);
      const tableList = tables.map((t) => `\`${t}\``).join(", ");
      const quickClause = quick ? " QUICK" : "";
      const result = await adapter.executeQuery(
        `REPAIR TABLE ${tableList}${quickClause}`,
      );
      return { results: result.rows, rowCount: result.rows?.length ?? 0 };
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
            notFound,
            flushed: validTables,
          };
        }

        const tableList = tables.map((t) => `\`${t}\``).join(", ");
        await adapter.executeQuery(`FLUSH TABLES ${tableList}`);
      } else {
        await adapter.executeQuery("FLUSH TABLES");
      }

      return { success: true };
    },
  };
}

export function createKillQueryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_kill_query",
    title: "MySQL Kill Query",
    description: "Kill a running query or connection.",
    group: "admin",
    inputSchema: KillQuerySchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { processId, connection } = KillQuerySchema.parse(params);
      const killType = connection ? "CONNECTION" : "QUERY";
      try {
        await adapter.executeQuery(`KILL ${killType} ${processId}`);
        return { success: true, killed: processId, type: killType };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Unknown thread id")) {
          return {
            success: false,
            error: `Process ID ${processId} not found`,
          };
        }
        throw error;
      }
    },
  };
}
