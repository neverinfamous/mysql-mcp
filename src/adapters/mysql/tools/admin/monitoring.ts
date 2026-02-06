/**
 * MySQL Admin Tools - Monitoring
 *
 * Tools for server and performance monitoring.
 * 7 tools: processlist, status, variables, innodb_status, replication, pool_stats, health.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ShowProcesslistSchema,
  ShowStatusSchema,
  ShowVariablesSchema,
} from "../../types.js";
import { z } from "zod";

export function createShowProcesslistTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_show_processlist",
    title: "MySQL Show Processlist",
    description: "Show all running processes and queries.",
    group: "monitoring",
    inputSchema: ShowProcesslistSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { full } = ShowProcesslistSchema.parse(params);
      const sql = full ? "SHOW FULL PROCESSLIST" : "SHOW PROCESSLIST";
      const result = await adapter.executeQuery(sql);
      return { processes: result.rows };
    },
  };
}

export function createShowStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_show_status",
    title: "MySQL Show Status",
    description: "Show server status variables.",
    group: "monitoring",
    inputSchema: ShowStatusSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { like, global } = ShowStatusSchema.parse(params);

      let sql = global ? "SHOW GLOBAL STATUS" : "SHOW STATUS";

      // SHOW commands don't support parameter binding - build SQL directly
      if (like) {
        // Escape the like pattern for safety
        const escapedLike = like.replace(/'/g, "''");
        sql += ` LIKE '${escapedLike}'`;
      }

      const result = await adapter.rawQuery(sql);

      // Convert to object for easier use
      // Handle both uppercase and Pascal case column names
      const status: Record<string, string> = {};
      for (const row of result.rows ?? []) {
        const name = (row["Variable_name"] ??
          row["VARIABLE_NAME"] ??
          row["variable_name"]) as string;
        const value = (row["Value"] ?? row["VALUE"] ?? row["value"]) as string;
        if (name) {
          status[name] = value;
        }
      }

      return { status, rowCount: result.rows?.length ?? 0 };
    },
  };
}

export function createShowVariablesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_show_variables",
    title: "MySQL Show Variables",
    description: "Show server configuration variables.",
    group: "monitoring",
    inputSchema: ShowVariablesSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { like, global } = ShowVariablesSchema.parse(params);

      let sql = global ? "SHOW GLOBAL VARIABLES" : "SHOW VARIABLES";

      // SHOW commands don't support parameter binding - build SQL directly
      if (like) {
        // Escape the like pattern for safety
        const escapedLike = like.replace(/'/g, "''");
        sql += ` LIKE '${escapedLike}'`;
      }

      const result = await adapter.rawQuery(sql);

      // Convert to object
      // Handle both uppercase and Pascal case column names
      const variables: Record<string, string> = {};
      for (const row of result.rows ?? []) {
        const name = (row["Variable_name"] ??
          row["VARIABLE_NAME"] ??
          row["variable_name"]) as string;
        const value = (row["Value"] ?? row["VALUE"] ?? row["value"]) as string;
        if (name) {
          variables[name] = value;
        }
      }

      return { variables, rowCount: result.rows?.length ?? 0 };
    },
  };
}

/**
 * Parse InnoDB status output into key metrics summary
 */
function parseInnodbStatusSummary(rawStatus: string): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  // Buffer Pool section
  const bufferPoolMatch = /Buffer pool size\s+(\d+)/.exec(rawStatus);
  const freeBuffersMatch = /Free buffers\s+(\d+)/.exec(rawStatus);
  const hitRateMatch = /Buffer pool hit rate\s+(\d+)\s*\/\s*(\d+)/.exec(
    rawStatus,
  );

  if (bufferPoolMatch ?? freeBuffersMatch ?? hitRateMatch) {
    summary["bufferPool"] = {
      size: bufferPoolMatch
        ? parseInt(bufferPoolMatch[1] ?? "0", 10)
        : undefined,
      freeBuffers: freeBuffersMatch
        ? parseInt(freeBuffersMatch[1] ?? "0", 10)
        : undefined,
      hitRate: hitRateMatch
        ? `${hitRateMatch[1] ?? "0"}/${hitRateMatch[2] ?? "0"}`
        : undefined,
    };
  }

  // Row Operations section
  const rowOpsMatch =
    /(\d+(?:\.\d+)?)\s+inserts\/s,\s*(\d+(?:\.\d+)?)\s+updates\/s,\s*(\d+(?:\.\d+)?)\s+deletes\/s,\s*(\d+(?:\.\d+)?)\s+reads\/s/.exec(
      rawStatus,
    );
  if (rowOpsMatch) {
    summary["rowOperations"] = {
      insertsPerSec: parseFloat(rowOpsMatch[1] ?? "0"),
      updatesPerSec: parseFloat(rowOpsMatch[2] ?? "0"),
      deletesPerSec: parseFloat(rowOpsMatch[3] ?? "0"),
      readsPerSec: parseFloat(rowOpsMatch[4] ?? "0"),
    };
  }

  // Log section
  const logSeqMatch = /Log sequence number\s+(\d+)/.exec(rawStatus);
  const checkpointMatch = /Last checkpoint at\s+(\d+)/.exec(rawStatus);
  if (logSeqMatch ?? checkpointMatch) {
    summary["log"] = {
      sequenceNumber: logSeqMatch
        ? parseInt(logSeqMatch[1] ?? "0", 10)
        : undefined,
      lastCheckpoint: checkpointMatch
        ? parseInt(checkpointMatch[1] ?? "0", 10)
        : undefined,
    };
  }

  // Transactions section
  const historyListMatch = /History list length\s+(\d+)/.exec(rawStatus);
  const trxCountMatch = /Trx id counter\s+(\d+)/.exec(rawStatus);
  if (historyListMatch ?? trxCountMatch) {
    summary["transactions"] = {
      historyListLength: historyListMatch
        ? parseInt(historyListMatch[1] ?? "0", 10)
        : undefined,
      trxIdCounter: trxCountMatch
        ? parseInt(trxCountMatch[1] ?? "0", 10)
        : undefined,
    };
  }

  // Semaphores section
  const osWaitsMatch = /OS WAIT ARRAY INFO: reservation count (\d+)/.exec(
    rawStatus,
  );
  if (osWaitsMatch) {
    summary["semaphores"] = {
      osWaitReservations: parseInt(osWaitsMatch[1] ?? "0", 10),
    };
  }

  return summary;
}

const InnodbStatusSchema = z.object({
  summary: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Return parsed summary with key metrics instead of raw output (recommended)",
    ),
});

export function createInnodbStatusTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_innodb_status",
    title: "MySQL InnoDB Status",
    description:
      "Get detailed InnoDB engine status. Use summary=true for parsed key metrics.",
    group: "monitoring",
    inputSchema: InnodbStatusSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { summary } = InnodbStatusSchema.parse(params);
      const result = await adapter.executeQuery("SHOW ENGINE INNODB STATUS");
      const rawRow = result.rows?.[0];
      const rawStatus =
        (rawRow?.["Status"] as string) ?? (rawRow?.["STATUS"] as string) ?? "";

      if (summary) {
        return { summary: parseInnodbStatusSummary(rawStatus) };
      }

      return { status: rawRow };
    },
  };
}

export function createReplicationStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_replication_status",
    title: "MySQL Replication Status",
    description: "Show replication slave/replica status.",
    group: "monitoring",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      // Try both old and new syntax
      try {
        const result = await adapter.executeQuery("SHOW REPLICA STATUS");
        if (!result.rows || result.rows.length === 0) {
          return {
            configured: false,
            message: "Replication is not configured on this server",
          };
        }
        return { configured: true, status: result.rows[0] };
      } catch {
        try {
          const result = await adapter.executeQuery("SHOW SLAVE STATUS");
          if (!result.rows || result.rows.length === 0) {
            return {
              configured: false,
              message: "Replication is not configured on this server",
            };
          }
          return { configured: true, status: result.rows[0] };
        } catch {
          return {
            configured: false,
            message: "Replication is not configured on this server",
          };
        }
      }
    },
  };
}

export function createPoolStatsTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_pool_stats",
    title: "MySQL Pool Stats",
    description: "Get connection pool statistics.",
    group: "monitoring",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      const pool = await Promise.resolve(adapter.getPool());
      if (!pool) {
        return { error: "Pool not available" };
      }
      return { poolStats: pool.getStats() };
    },
  };
}

export function createServerHealthTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_server_health",
    title: "MySQL Server Health",
    description: "Get comprehensive server health information.",
    group: "monitoring",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      const health = await adapter.getHealth();

      // Get additional metrics
      const uptimeResult = await adapter.executeQuery(
        "SHOW GLOBAL STATUS LIKE 'Uptime'",
      );
      const uptime = uptimeResult.rows?.[0]?.["Value"];

      const connectionsResult = await adapter.executeQuery(
        "SHOW GLOBAL STATUS LIKE 'Threads_connected'",
      );
      const connections = connectionsResult.rows?.[0]?.["Value"];

      const queriesResult = await adapter.executeQuery(
        "SHOW GLOBAL STATUS LIKE 'Questions'",
      );
      const queries = queriesResult.rows?.[0]?.["Value"];

      return {
        ...health,
        uptime:
          uptime != null && typeof uptime === "string"
            ? parseInt(uptime, 10)
            : undefined,
        activeConnections:
          connections != null && typeof connections === "string"
            ? parseInt(connections, 10)
            : undefined,
        totalQueries:
          queries != null && typeof queries === "string"
            ? parseInt(queries, 10)
            : undefined,
      };
    },
  };
}
