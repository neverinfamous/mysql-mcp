/**
 * MySQL Replication Tools
 *
 * Replication monitoring and management.
 * 5 tools: master_status, slave_status, binlog_events, gtid_status, replication_lag.
 */

import type { MySQLAdapter } from "../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { ErrorCategory, MySQLMcpError } from "../../../types/index.js";
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
  stripErrorPrefix,
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
  const handlerSchema = z.object({}).strict();
  const inputSchema = z.object({}).strict().describe("Note: This tool takes no parameters.");

  return {
    name: "mysql_master_status",
    title: "MySQL Master Status",
    description: "Get binary log position from master/source server.",
    group: "replication",
    inputSchema: inputSchema,
    outputSchema: MasterStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        handlerSchema.parse(_params);
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
      try {
        const result = await adapter.executeQuery("SHOW BINARY LOG STATUS");
        const response = {
          success: true as const,
          data: { status: result.rows?.[0] },
        };
        return withTokenEstimate(response);
      } catch (error) {
        const e = error as { code?: string; errno?: number; message?: string };
        if (e.code === "ER_PARSE_ERROR" || e.errno === 1064 || e.message?.toLowerCase().includes("syntax")) {
          try {
            const result = await adapter.executeQuery("SHOW MASTER STATUS");
            const response = {
              success: true as const,
              data: { status: result.rows?.[0] },
            };
            return withTokenEstimate(response);
          } catch (error2) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Failed to retrieve master status: ${stripErrorPrefix(error2 instanceof Error ? error2.message : String(error2))}`,
                "QUERY_ERROR",
                ErrorCategory.QUERY
              )
            );
          }
        }
        return formatHandlerErrorResponse(
          new MySQLMcpError(
            `Failed to retrieve binary log status: ${stripErrorPrefix(e.message || String(error))}`,
            "QUERY_ERROR",
            ErrorCategory.QUERY
          )
        );
      }
    },
  };
}

function createSlaveStatusTool(adapter: MySQLAdapter): ToolDefinition {
  const handlerSchema = z.object({
    channel: z.string().max(64).optional().describe("Optional replication channel name"),
  }).strict();
  const inputSchema = z.object({
    channel: z.string().max(64).optional().describe("Optional replication channel name"),
  }).strict();

  return {
    name: "mysql_slave_status",
    title: "MySQL Slave Status",
    description: "Get detailed replication slave/replica status.",
    group: "replication",
    inputSchema: inputSchema,
    outputSchema: SlaveStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      let channel: string | undefined;
      try {
        const parsed = handlerSchema.parse(_params);
        channel = parsed.channel;
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
      
      const channelClause = channel ? ` FOR CHANNEL '${channel.replace(/\\/g, '\\\\').replace(/'/g, "''")}'` : "";

      // Try new syntax first
      try {
        const result = await adapter.executeQuery(`SHOW REPLICA STATUS${channelClause}`);
        const status = result.rows?.[0];
        if (status) {
          const response = { success: true as const, data: { status } };
          return withTokenEstimate(response);
        }
      } catch (error) {
        const e = error as { code?: string; errno?: number; message?: string };
        if (e.code === "ER_PARSE_ERROR" || e.errno === 1064 || e.message?.toLowerCase().includes("syntax")) {
          try {
            const result = await adapter.executeQuery(`SHOW SLAVE STATUS${channelClause}`);
            const status = result.rows?.[0];
            if (status) {
              const response = { success: true as const, data: { status } };
              return withTokenEstimate(response);
            }
          } catch (error2) {
            const e2 = error2 as { message?: string };
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Failed to retrieve slave status: ${stripErrorPrefix(e2.message || String(error2))}`,
                "QUERY_ERROR",
                ErrorCategory.QUERY
              )
            );
          }
        } else {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Failed to retrieve replica status: ${stripErrorPrefix(e.message || String(error))}`,
              "QUERY_ERROR",
              ErrorCategory.QUERY
            )
          );
        }
      }
      return withTokenEstimate({
        success: true as const,
        data: { configured: false },
      });
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
          parts.push(`IN '${effectiveLogFile.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`);
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
            let info = row["Info"];
            if (typeof info === "string" && info.length > 50) {
              info = info.substring(0, 47) + "...";
            }
            return {
              pos: row["Pos"],
              type: row["Event_type"],
              end: row["End_log_pos"],
              info
            };
          });

          const response = {
            success: true as const,
            data: { events },
          };
          return withTokenEstimate(response);
        } catch (e) {
          const message = stripErrorPrefix(e instanceof Error ? e.message : String(e));
          const targetFile = effectiveLogFile || logFile;
          if (targetFile && (message.includes("Could not find target log") || message.includes("Connection lost"))) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Binlog file '${targetFile}' not found (or server rejected file)`,
                "DOMAIN_ERROR",
                ErrorCategory.RESOURCE
              )
            );
          }
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Failed to read binlog events: ${message}`,
              "QUERY_ERROR",
              ErrorCategory.QUERY
            )
          );
        }
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}

function createGtidStatusTool(adapter: MySQLAdapter): ToolDefinition {
  const handlerSchema = z.object({}).strict();
  const inputSchema = z.object({}).strict().describe("Note: This tool takes no parameters.");

  return {
    name: "mysql_gtid_status",
    title: "MySQL GTID Status",
    description: "Get Global Transaction ID (GTID) status for replication.",
    group: "replication",
    inputSchema: inputSchema,
    outputSchema: GtidStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        handlerSchema.parse(_params);
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
      try {
        const result = await adapter.executeQuery(
          "SHOW GLOBAL VARIABLES LIKE 'gtid_%'",
        );

        const rows = result.rows ?? [];
        const getValue = (name: string): unknown =>
          rows.find((r: Record<string, unknown>) => r["Variable_name"] === name)?.["Value"];

        const response = {
          success: true as const,
          data: {
            gtidExecuted: getValue("gtid_executed"),
            gtidPurged: getValue("gtid_purged"),
            gtidMode: getValue("gtid_mode"),
          },
        };
        return withTokenEstimate(response);
      } catch (e) {
        return formatHandlerErrorResponse(
          new MySQLMcpError(
            `Failed to retrieve GTID status: ${stripErrorPrefix(e instanceof Error ? e.message : String(e))}`,
            "QUERY_ERROR",
            ErrorCategory.QUERY
          )
        );
      }
    },
  };
}

function createReplicationLagTool(adapter: MySQLAdapter): ToolDefinition {
  const handlerSchema = z.object({
    channel: z.string().max(64).optional().describe("Optional replication channel name"),
  }).strict();
  const inputSchema = z.object({
    channel: z.string().max(64).optional().describe("Optional replication channel name"),
  }).strict();

  return {
    name: "mysql_replication_lag",
    title: "MySQL Replication Lag",
    description: "Calculate replication lag in seconds.",
    group: "replication",
    inputSchema: inputSchema,
    outputSchema: ReplicationLagOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      let channel: string | undefined;
      try {
        const parsed = handlerSchema.parse(_params);
        channel = parsed.channel;
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
      const channelClause = channel ? ` FOR CHANNEL '${channel.replace(/\\/g, '\\\\').replace(/'/g, "''")}'` : "";

      // Try to get Seconds_Behind_Master from replica status
      try {
        const result = await adapter.executeQuery(`SHOW REPLICA STATUS${channelClause}`);
        const status = result.rows?.[0];

        if (status != null) {
          const response = {
            success: true as const,
            data: {
              lagSeconds:
                status["Seconds_Behind_Source"] != null
                  ? Number(status["Seconds_Behind_Source"])
                  : status["Seconds_Behind_Master"] != null
                  ? Number(status["Seconds_Behind_Master"])
                  : null,
              ioRunning:
                status["Replica_IO_Running"] ?? status["Slave_IO_Running"],
              sqlRunning:
                status["Replica_SQL_Running"] ?? status["Slave_SQL_Running"],
              lastError: status["Last_Error"],
            },
          };
          return withTokenEstimate(response);
        }
      } catch (error) {
        const e = error as { code?: string; errno?: number; message?: string };
        if (e.code === "ER_PARSE_ERROR" || e.errno === 1064 || e.message?.toLowerCase().includes("syntax")) {
          try {
            const result = await adapter.executeQuery(`SHOW SLAVE STATUS${channelClause}`);
            const status = result.rows?.[0];

            if (status != null) {
              const response = {
                success: true as const,
                data: {
                  lagSeconds:
                    status["Seconds_Behind_Master"] != null
                      ? Number(status["Seconds_Behind_Master"])
                      : null,
                  ioRunning: status["Slave_IO_Running"],
                  sqlRunning: status["Slave_SQL_Running"],
                  lastError: status["Last_Error"],
                },
              };
              return withTokenEstimate(response);
            }
          } catch (error2) {
            const e2 = error2 as { message?: string };
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Failed to retrieve slave status: ${stripErrorPrefix(e2.message || String(error2))}`,
                "QUERY_ERROR",
                ErrorCategory.QUERY
              )
            );
          }
        } else {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Failed to retrieve replica status: ${stripErrorPrefix(e.message || String(error))}`,
              "QUERY_ERROR",
              ErrorCategory.QUERY
            )
          );
        }
      }

      return withTokenEstimate({
        success: true as const,
        data: { lagSeconds: null },
      });
    },
  };
}
