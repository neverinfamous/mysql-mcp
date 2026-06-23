/**
 * MySQL Replication Tools
 *
 * Replication monitoring and management.
 * 5 tools: master_status, slave_status, binlog_events, gtid_status, replication_lag.
 */

import type { MySQLAdapter } from "../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  BinlogEventsSchemaBase,
  BinlogEventsSchema,
  MasterStatusOutputSchema,
  SlaveStatusOutputSchema,
  BinlogEventsOutputSchema,
  GtidStatusOutputSchema,
  ReplicationLagOutputSchema,
} from "../schemas/replication.js";
import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "./core/error-helpers.js";
import { READ_ONLY } from "../../../utils/annotations.js";

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
    outputSchema: MasterStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      // Try new syntax first, then old
      try {
        const result = await adapter.executeQuery("SHOW BINARY LOG STATUS");
        const response = {
          success: true as const,
          data: { status: result.rows?.[0] },
        };
        return withTokenEstimate(response);
      } catch {
        try {
          const result = await adapter.executeQuery("SHOW MASTER STATUS");
          const response = {
            success: true as const,
            data: { status: result.rows?.[0] },
          };
          return withTokenEstimate(response);
        } catch (e) {
          return formatHandlerErrorResponse(
            `Binary logging may not be enabled: ${String(e)}`,
          );
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
    outputSchema: SlaveStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      // Try new syntax first
      try {
        const result = await adapter.executeQuery("SHOW REPLICA STATUS");
        const status = result.rows?.[0];
        if (status) {
          const response = { success: true as const, data: { status } };
          return withTokenEstimate(response);
        }
      } catch {
        try {
          const result = await adapter.executeQuery("SHOW SLAVE STATUS");
          const status = result.rows?.[0];
          if (status) {
            const response = { success: true as const, data: { status } };
            return withTokenEstimate(response);
          }
        } catch {
          // Fall through to not-configured response
        }
      }
      return formatHandlerErrorResponse(
        "This server is not configured as a replica",
      );
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
    inputSchema: BinlogEventsSchemaBase,
    outputSchema: BinlogEventsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { logFile, position, limit } = BinlogEventsSchema.parse(params);

        // Guard: LIMIT 0 on SHOW BINLOG EVENTS returns ALL events (unlike SELECT LIMIT 0)
        if (limit === 0) {
          const response = { success: true as const, data: { events: [] } };
          return withTokenEstimate(response);
        }

        // Resolve effective log file: use provided or fetch current from master status
        let effectiveLogFile = logFile;
        if (!effectiveLogFile) {
          try {
            let masterResult;
            try {
              masterResult = await adapter.executeQuery(
                "SHOW BINARY LOG STATUS",
              );
            } catch {
              masterResult = await adapter.executeQuery("SHOW MASTER STATUS");
            }
            const currentFile = masterResult.rows?.[0]?.["File"] as
              | string
              | undefined;
            if (currentFile) {
              effectiveLogFile = currentFile;
            }
          } catch {
            // Binary logging may not be enabled; fall through to default behavior
          }
        }

        let sql = "SHOW BINLOG EVENTS";
        const parts: string[] = [];

        if (effectiveLogFile) {
          parts.push(`IN '${effectiveLogFile}'`);
        }
        if (position != null) {
          parts.push(`FROM ${position}`);
        }
        parts.push(`LIMIT ${limit}`);

        sql += " " + parts.join(" ");

        try {
          const result = await adapter.executeQuery(sql);
          
          // Strip repetitive columns to save tokens and prevent payload bloat
          const events = (result.rows ?? []).map((row: Record<string, unknown>) => {
            const optimized = { ...row };
            delete optimized["Log_name"];
            delete optimized["Server_id"];

            if (
              typeof optimized["Info"] === "string" &&
              optimized["Info"].length > 150
            ) {
              optimized["Info"] = optimized["Info"].substring(0, 147) + "...";
            }
            return optimized;
          });

          const response = {
            success: true as const,
            data: { events },
          };
          return withTokenEstimate(response);
        } catch (e) {
          const message = String(e);
          const targetFile = effectiveLogFile || logFile;
          if (targetFile && message.includes("Could not find target log")) {
            return formatHandlerErrorResponse(
              `Binlog file '${targetFile}' not found`,
            );
          }
          return formatHandlerErrorResponse(
            `Failed to read binlog events: ${message}`,
          );
        }
      } catch (e) {
        return formatHandlerErrorResponse(e);
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
    outputSchema: GtidStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
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

        const response = {
          success: true as const,
          data: {
            gtidExecuted: executedResult.rows?.[0]?.["gtid_executed"],
            gtidPurged: purgedResult.rows?.[0]?.["gtid_purged"],
            gtidMode: modeResult.rows?.[0]?.["gtid_mode"],
          },
        };
        return withTokenEstimate(response);
      } catch (e) {
        return formatHandlerErrorResponse(
          `Failed to retrieve GTID status: ${String(e)}`,
        );
      }
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
    outputSchema: ReplicationLagOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      // Try to get Seconds_Behind_Master from replica status
      try {
        const result = await adapter.executeQuery("SHOW REPLICA STATUS");
        const status = result.rows?.[0];

        if (status != null) {
          const response = {
            success: true as const,
            data: {
              lagSeconds:
                status["Seconds_Behind_Source"] ??
                status["Seconds_Behind_Master"],
              ioRunning:
                status["Replica_IO_Running"] ?? status["Slave_IO_Running"],
              sqlRunning:
                status["Replica_SQL_Running"] ?? status["Slave_SQL_Running"],
              lastError: status["Last_Error"],
            },
          };
          return withTokenEstimate(response);
        }
      } catch {
        try {
          const result = await adapter.executeQuery("SHOW SLAVE STATUS");
          const status = result.rows?.[0];

          if (status != null) {
            const response = {
              success: true as const,
              data: {
                lagSeconds: status["Seconds_Behind_Master"],
                ioRunning: status["Slave_IO_Running"],
                sqlRunning: status["Slave_SQL_Running"],
                lastError: status["Last_Error"],
              },
            };
            return withTokenEstimate(response);
          }
        } catch {
          // Not a replica
        }
      }

      return formatHandlerErrorResponse(
        "This server is not configured as a replica",
      );
    },
  };
}
