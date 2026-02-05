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
  AnalyzeTableSchema,
  CheckTableSchema,
  FlushTablesSchema,
  KillQuerySchema,
} from "../../types.js";
import { z } from "zod";

export function createOptimizeTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_optimize_table",
    title: "MySQL Optimize Table",
    description: "Optimize tables to reclaim unused space and defragment data.",
    group: "admin",
    inputSchema: OptimizeTableSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { tables } = OptimizeTableSchema.parse(params);
      const tableList = tables.map((t) => `\`${t}\``).join(", ");
      const result = await adapter.executeQuery(`OPTIMIZE TABLE ${tableList}`);
      return { results: result.rows };
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
    inputSchema: AnalyzeTableSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { tables } = AnalyzeTableSchema.parse(params);
      const tableList = tables.map((t) => `\`${t}\``).join(", ");
      const result = await adapter.executeQuery(`ANALYZE TABLE ${tableList}`);
      return { results: result.rows };
    },
  };
}

export function createCheckTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_check_table",
    title: "MySQL Check Table",
    description: "Check tables for errors.",
    group: "admin",
    inputSchema: CheckTableSchema,
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
      return { results: result.rows };
    },
  };
}

export function createFlushTablesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_flush_tables",
    title: "MySQL Flush Tables",
    description: "Flush tables to ensure data is written to disk.",
    group: "admin",
    inputSchema: FlushTablesSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { tables } = FlushTablesSchema.parse(params);

      let sql = "FLUSH TABLES";
      if (tables && tables.length > 0) {
        const tableList = tables.map((t) => `\`${t}\``).join(", ");
        sql = `FLUSH TABLES ${tableList}`;
      }

      await adapter.executeQuery(sql);
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
      await adapter.executeQuery(`KILL ${killType} ${processId}`);
      return { success: true, killed: processId, type: killType };
    },
  };
}
