/**
 * MySQL Replication Tools
 *
 * Replication monitoring and management.
 * 5 tools: master_status, slave_status, binlog_events, gtid_status, replication_lag.
 */

import type { MySQLAdapter } from "../MySQLAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { BinlogEventsSchema } from "../types.js";
import { z } from "zod";

/**
 * Get replication tools
 */
export function getReplicationTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createMasterStatusTool(adapter),
    createSlaveStatusTool(adapter),
    createBinlogEventsTool(adapter),
    createGtidStatusTool(adapter),
    createReplicationLagTool(adapter),
  ];
}

function createMasterStatusTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_master_status",
    title: "MySQL Master Status",
    description: "Get binary log position from master/source server.",
    group: "replication",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      // Try new syntax first, then old
      try {
        const result = await adapter.executeQuery("SHOW BINARY LOG STATUS");
        return { status: result.rows?.[0] };
      } catch {
        try {
          const result = await adapter.executeQuery("SHOW MASTER STATUS");
          return { status: result.rows?.[0] };
        } catch (e) {
          return {
            error: "Binary logging may not be enabled",
            details: String(e),
          };
        }
      }
    },
  };
}

function createSlaveStatusTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_slave_status",
    title: "MySQL Slave Status",
    description: "Get detailed replication slave/replica status.",
    group: "replication",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      // Try new syntax first
      try {
        const result = await adapter.executeQuery("SHOW REPLICA STATUS");
        const status = result.rows?.[0];
        if (status) {
          return { status };
        }
      } catch {
        try {
          const result = await adapter.executeQuery("SHOW SLAVE STATUS");
          const status = result.rows?.[0];
          if (status) {
            return { status };
          }
        } catch {
          // Fall through to not-configured response
        }
      }
      return {
        configured: false,
        message: "This server is not configured as a replica",
      };
    },
  };
}

function createBinlogEventsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_binlog_events",
    title: "MySQL Binlog Events",
    description:
      "View binary log events for point-in-time recovery or replication debugging.",
    group: "replication",
    inputSchema: BinlogEventsSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { logFile, position, limit } = BinlogEventsSchema.parse(params);

      let sql = "SHOW BINLOG EVENTS";
      const parts: string[] = [];

      if (logFile) {
        parts.push(`IN '${logFile}'`);
      }
      if (position != null) {
        parts.push(`FROM ${position}`);
      }
      parts.push(`LIMIT ${limit}`);

      sql += " " + parts.join(" ");

      try {
        const result = await adapter.executeQuery(sql);
        return { events: result.rows };
      } catch (e) {
        const message = String(e);
        if (logFile && message.includes("Could not find target log")) {
          return {
            success: false,
            logFile,
            error: `Binlog file '${logFile}' not found`,
          };
        }
        return {
          success: false,
          error: `Failed to read binlog events: ${message}`,
        };
      }
    },
  };
}

function createGtidStatusTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_gtid_status",
    title: "MySQL GTID Status",
    description: "Get Global Transaction ID (GTID) status for replication.",
    group: "replication",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      // Get GTID executed
      const executedResult = await adapter.executeQuery(
        "SELECT @@global.gtid_executed as gtid_executed",
      );

      // Get GTID purged
      const purgedResult = await adapter.executeQuery(
        "SELECT @@global.gtid_purged as gtid_purged",
      );

      // Get GTID mode
      const modeResult = await adapter.executeQuery(
        "SELECT @@global.gtid_mode as gtid_mode",
      );

      return {
        gtidExecuted: executedResult.rows?.[0]?.["gtid_executed"],
        gtidPurged: purgedResult.rows?.[0]?.["gtid_purged"],
        gtidMode: modeResult.rows?.[0]?.["gtid_mode"],
      };
    },
  };
}

function createReplicationLagTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_replication_lag",
    title: "MySQL Replication Lag",
    description: "Calculate replication lag in seconds.",
    group: "replication",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      // Try to get Seconds_Behind_Master from replica status
      try {
        const result = await adapter.executeQuery("SHOW REPLICA STATUS");
        const status = result.rows?.[0];

        if (status != null) {
          return {
            lagSeconds:
              status["Seconds_Behind_Source"] ??
              status["Seconds_Behind_Master"],
            ioRunning:
              status["Replica_IO_Running"] ?? status["Slave_IO_Running"],
            sqlRunning:
              status["Replica_SQL_Running"] ?? status["Slave_SQL_Running"],
            lastError: status["Last_Error"],
          };
        }
      } catch {
        try {
          const result = await adapter.executeQuery("SHOW SLAVE STATUS");
          const status = result.rows?.[0];

          if (status != null) {
            return {
              lagSeconds: status["Seconds_Behind_Master"],
              ioRunning: status["Slave_IO_Running"],
              sqlRunning: status["Slave_SQL_Running"],
              lastError: status["Last_Error"],
            };
          }
        } catch {
          // Not a replica
        }
      }

      return {
        lagSeconds: null,
        message: "This server is not configured as a replica",
      };
    },
  };
}
