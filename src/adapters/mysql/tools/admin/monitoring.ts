/**
 * MySQL Admin Tools - Monitoring
 *
 * Tools for server and performance monitoring.
 * 7 tools: processlist, status, variables, innodb_status, replication, pool_stats, health.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ShowProcesslistSchema,
  ShowStatusSchema,
  ShowVariablesSchema,
} from "../../schemas/index.js";
import { z } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";

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
      try {
        const { full, limit } = ShowProcesslistSchema.parse(params);
        const sql = full ? "SHOW FULL PROCESSLIST" : "SHOW PROCESSLIST";
        const result = await adapter.executeQuery(sql);
        const allRows = result.rows ?? [];
        const totalAvailable = allRows.length;
        const limited = totalAvailable > limit;
        const processes = limited ? allRows.slice(0, limit) : allRows;
        return {
          success: true,
          processes,
          count: processes.length,
          ...(limited ? { limited: true, totalAvailable } : {}),
        };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
      try {
        const { like, global, limit } = ShowStatusSchema.parse(params);
        if (limit !== undefined && limit < 1) {
          return {
            success: false as const,
            error: "limit must be a positive integer",
          };
        }
        const effectiveLimit = limit ?? 30;

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
          const value = (row["Value"] ??
            row["VALUE"] ??
            row["value"]) as string;
          if (name) {
            // Redact RSA public key blobs (multi-line PEM certificates)
            status[name] = value?.includes("-----BEGIN PUBLIC KEY-----")
              ? "[REDACTED]"
              : value;
          }
        }

        const totalAvailable = Object.keys(status).length;
        const entries = Object.entries(status);
        const limited = entries.length > effectiveLimit;
        const truncated = limited
          ? Object.fromEntries(entries.slice(0, effectiveLimit))
          : status;

        return {
          success: true,
          status: truncated,
          rowCount: Object.keys(truncated).length,
          totalAvailable,
          ...(limited && { limited: true }),
        };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
      try {
        const { like, global, limit } = ShowVariablesSchema.parse(params);
        if (limit !== undefined && limit < 1) {
          return {
            success: false as const,
            error: "limit must be a positive integer",
          };
        }
        const effectiveLimit = limit ?? 30;

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
          const value = (row["Value"] ??
            row["VALUE"] ??
            row["value"]) as string;
          if (name) {
            variables[name] = value;
          }
        }

        const totalAvailable = Object.keys(variables).length;
        const entries = Object.entries(variables);
        const limited = entries.length > effectiveLimit;
        const truncated = limited
          ? Object.fromEntries(entries.slice(0, effectiveLimit))
          : variables;

        return {
          success: true,
          variables: truncated,
          rowCount: Object.keys(truncated).length,
          totalAvailable,
          ...(limited && { limited: true }),
        };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    .default(true)
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
      try {
        const { summary } = InnodbStatusSchema.parse(params);
        const result = await adapter.executeQuery("SHOW ENGINE INNODB STATUS");
        const rawRow = result.rows?.[0];
        const rawStatus =
          (rawRow?.["Status"] as string) ??
          (rawRow?.["STATUS"] as string) ??
          "";

        if (summary) {
          return { success: true, summary: parseInnodbStatusSummary(rawStatus) };
        }

        return { success: true, status: rawRow };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createReplicationStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    summary: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Return key replication metrics only instead of full 50+ field output (recommended)",
      ),
  });

  /** Extract key metrics from raw SHOW REPLICA STATUS row */
  function extractReplicationSummary(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    // Field names differ between MySQL versions (Slave_ vs Replica_)
    return {
      ioRunning:
        row["Replica_IO_Running"] ??
        row["Slave_IO_Running"] ??
        row["replica_io_running"],
      sqlRunning:
        row["Replica_SQL_Running"] ??
        row["Slave_SQL_Running"] ??
        row["replica_sql_running"],
      secondsBehind:
        row["Seconds_Behind_Master"] ??
        row["Seconds_Behind_Source"] ??
        row["seconds_behind_master"],
      lastError:
        row["Last_Error"] ?? row["Last_SQL_Error"] ?? row["last_error"],
      lastErrno:
        row["Last_Errno"] ?? row["Last_SQL_Errno"] ?? row["last_errno"],
      sourceHost:
        row["Master_Host"] ?? row["Source_Host"] ?? row["master_host"],
      sourcePort:
        row["Master_Port"] ?? row["Source_Port"] ?? row["master_port"],
      executedGtidSet:
        row["Executed_Gtid_Set"] ?? row["executed_gtid_set"],
      retrievedGtidSet:
        row["Retrieved_Gtid_Set"] ?? row["retrieved_gtid_set"],
      channelName: row["Channel_Name"] ?? row["channel_name"],
    };
  }

  return {
    name: "mysql_replication_status",
    title: "MySQL Replication Status",
    description:
      "Show replication slave/replica status. Use summary=true for key metrics only.",
    group: "monitoring",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = schema.parse(params);

        // Try both old and new syntax
        try {
          const result = await adapter.executeQuery("SHOW REPLICA STATUS");
          if (!result.rows || result.rows.length === 0) {
            return {
              success: true,
              configured: false,
              message: "Replication is not configured on this server",
            };
          }
          const first = result.rows[0];
          if (!first) {
            return {
              success: true,
              configured: false,
              message: "Replication is not configured on this server",
            };
          }
          return {
            success: true,
            configured: true,
            status: summary ? extractReplicationSummary(first) : first,
            ...(summary ? { summary: true } : {}),
          };
        } catch {
          try {
            const result = await adapter.executeQuery("SHOW SLAVE STATUS");
            if (!result.rows || result.rows.length === 0) {
              return {
                success: true,
                configured: false,
                message: "Replication is not configured on this server",
              };
            }
            const first = result.rows[0];
            if (!first) {
              return {
                success: true,
                configured: false,
                message: "Replication is not configured on this server",
              };
            }
            return {
              success: true,
              configured: true,
              status: summary ? extractReplicationSummary(first) : first,
              ...(summary ? { summary: true } : {}),
            };
          } catch {
            return {
              success: true,
              configured: false,
              message: "Replication is not configured on this server",
            };
          }
        }
      } catch (err) {
        return formatHandlerErrorResponse(err);
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
      try {
        const pool = await Promise.resolve(adapter.getPool());
        if (!pool) {
          return { success: false as const, error: "Pool not available" };
        }
        return { success: true, poolStats: pool.getStats() };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
      try {
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
          success: true,
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
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
