/**
 * ProxySQL Management Tools
 *
 * Tools for monitoring and managing ProxySQL via its MySQL-protocol admin interface.
 * 11 tools total.
 *
 * ProxySQL admin interface documentation:
 * https://proxysql.com/documentation/ProxySQL-Admin-Interface/
 */

import mysql from "mysql2/promise";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "./core/error-helpers.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import type { MySQLAdapter } from "../mysql-adapter/index.js";
import {
  ProxySQLBaseInputSchema,
  ProxySQLStatusInputSchema,
  ProxySQLStatusInputSchemaBase,
  ProxySQLLimitInputSchema,
  ProxySQLLimitInputSchemaBase,
  ProxySQLHostgroupInputSchema,
  ProxySQLHostgroupInputSchemaBase,
  ProxySQLVariableFilterSchema,
  ProxySQLVariableFilterSchemaBase,
  ProxySQLCommandInputSchema,
  ProxySQLCommandInputSchemaBase,
  ProxySQLStatusOutputSchema,
  ProxySQLRuntimeStatusOutputSchema,
  ProxySQLServersOutputSchema,
  ProxySQLQueryRulesOutputSchema,
  ProxySQLQueryDigestOutputSchema,
  ProxySQLConnectionPoolOutputSchema,
  ProxySQLUsersOutputSchema,
  ProxySQLGlobalVariablesOutputSchema,
  ProxySQLMemoryStatsOutputSchema,
  ProxySQLCommandsOutputSchema,
  ProxySQLProcessListOutputSchema,
  type ProxySQLConfig,
} from "../schemas/proxysql.js";

/**
 * Safe character set for LIKE patterns.
 * Allows alphanumeric, underscore, dash, dot, percent (%), and space.
 * Rejects SQL injection characters like single quotes, semicolons, parentheses, etc.
 */
const LIKE_SAFE_RE = /^[a-zA-Z0-9_%\-. *]+$/;

// =============================================================================
// ProxySQL Connection Helper
// =============================================================================

/**
 * Get ProxySQL configuration from environment variables
 */
function getProxySQLConfig(): ProxySQLConfig {
  return {
    host: process.env["PROXYSQL_HOST"] ?? "localhost",
    port: parseInt(process.env["PROXYSQL_PORT"] ?? "6032", 10),
    user: process.env["PROXYSQL_USER"] ?? "admin",
    password: process.env["PROXYSQL_PASSWORD"] ?? "admin",
  };
}

/**
 * Execute a query on ProxySQL admin interface
 */
async function proxySQLQuery(
  sql: string,
  config?: ProxySQLConfig,
): Promise<Record<string, unknown>[]> {
  const cfg = config ?? getProxySQLConfig();

  const connection = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
  });

  try {
    const [rows] = await connection.query(sql);
    return rows as Record<string, unknown>[];
  } finally {
    await connection.end();
  }
}

// =============================================================================
// Sensitive Variable Redaction
// =============================================================================

/** Patterns matching variable names that contain credentials */
const SENSITIVE_VARIABLE_PATTERNS = [/password/i, /credentials/i];

/**
 * Redact variable_value for rows whose variable_name matches sensitive patterns.
 * Prevents plaintext credential exposure in tool responses.
 */
function redactSensitiveVariables(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const varName = (row["variable_name"] as string) ?? "";
    const isSensitive = SENSITIVE_VARIABLE_PATTERNS.some((p) =>
      p.test(varName),
    );
    if (isSensitive) {
      return { ...row, variable_value: "********" };
    }
    return row;
  });
}

// =============================================================================
// Tool Registration
// =============================================================================

/**
 * Get all ProxySQL management tools
 */
export function getProxySQLTools(_adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createProxySQLStatusTool(),
    createProxySQLServersTool(),
    createProxySQLQueryRulesTool(),
    createProxySQLQueryDigestTool(),
    createProxySQLConnectionPoolTool(),
    createProxySQLUsersTool(),
    createProxySQLGlobalVariablesTool(),
    createProxySQLRuntimeStatusTool(),
    createProxySQLMemoryStatsTool(),
    createProxySQLCommandsTool(),
    createProxySQLProcessListTool(),
  ];
}

// =============================================================================
// Status Tools
// =============================================================================

/**
 * Get ProxySQL status and version info
 */
function createProxySQLStatusTool(): ToolDefinition {
  return {
    name: "proxysql_status",
    title: "ProxySQL Status",
    description:
      "Get ProxySQL version, uptime, and runtime statistics. Returns global status variables from stats_mysql_global. Use summary: true for condensed key metrics.",
    group: "proxysql",
    inputSchema: ProxySQLStatusInputSchemaBase,
    outputSchema: ProxySQLStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = ProxySQLStatusInputSchema.parse(params);
        const rows = await proxySQLQuery("SELECT * FROM stats_mysql_global");
        const [versionRow] = await proxySQLQuery(
          "SELECT variable_value FROM global_variables WHERE variable_name = 'admin-version'",
        );
        const version = (versionRow?.["variable_value"] as string) ?? "unknown";

        const uptimeRow = rows.find(
          (r) => r["Variable_Name"] === "ProxySQL_Uptime",
        );
        const uptime = (uptimeRow?.["Variable_Value"] as string) ?? "0";

        if (summary) {
          // Key metrics for summary mode
          const keyMetrics = [
            "ProxySQL_Uptime",
            "Questions",
            "Slow_queries",
            "Active_Transactions",
            "Client_Connections_connected",
            "Client_Connections_created",
            "Server_Connections_connected",
            "Server_Connections_created",
            "Query_Cache_Entries",
            "Query_Cache_Memory_bytes",
            "mysql_backend_buffers_bytes",
            "mysql_frontend_buffers_bytes",
          ];
          const filteredRows = rows.filter((row) =>
            keyMetrics.includes(row["Variable_Name"] as string),
          );
          return withTokenEstimate({
            success: true,
            data: {
              summary: true,
              version,
              uptime,
              stats: filteredRows,
              totalVarsAvailable: rows.length,
            },
          });
        }

        return withTokenEstimate({
          success: true,
          data: {
            summary: false,
            version,
            uptime,
            stats: rows,
            totalVarsAvailable: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * Get ProxySQL runtime status
 */
function createProxySQLRuntimeStatusTool(): ToolDefinition {
  return {
    name: "proxysql_runtime_status",
    title: "ProxySQL Runtime Status",
    description:
      "Get ProxySQL runtime configuration status including version info and admin variables. Use summary: true for condensed key variables only.",
    group: "proxysql",
    inputSchema: ProxySQLStatusInputSchemaBase,
    outputSchema: ProxySQLRuntimeStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = ProxySQLStatusInputSchema.parse(params);
        const [versionRow] = await proxySQLQuery(
          "SELECT variable_value FROM global_variables WHERE variable_name = 'admin-version'",
        );
        const adminVars = await proxySQLQuery(
          "SELECT * FROM global_variables WHERE variable_name LIKE 'admin-%'",
        );

        // Redact sensitive admin variables (passwords, credentials)
        const redactedVars = redactSensitiveVariables(adminVars);

        if (summary) {
          // Key admin variables for summary mode
          const keyAdminVars = [
            "admin-version",
            "admin-read_only",
            "admin-cluster_username",
            "admin-mysql_ifaces",
            "admin-restapi_enabled",
            "admin-web_enabled",
            "admin-stats_mysql_connection_pool",
          ];
          const filteredVars = redactedVars.filter((row) =>
            keyAdminVars.includes(row["variable_name"] as string),
          );
          return withTokenEstimate({
            success: true,
            data: {
              summary: true,
              version: versionRow?.["variable_value"] ?? "unknown",
              adminVariables: filteredVars,
              totalAdminVarsAvailable: redactedVars.length,
            },
          });
        }

        return withTokenEstimate({
          success: true,
          data: {
            summary: false,
            version: versionRow?.["variable_value"] ?? "unknown",
            adminVariables: redactedVars,
            totalAdminVarsAvailable: redactedVars.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// Server and Hostgroup Tools
// =============================================================================

/**
 * List configured backend MySQL servers
 */
function createProxySQLServersTool(): ToolDefinition {
  return {
    name: "proxysql_servers",
    title: "ProxySQL Servers",
    description:
      "List configured backend MySQL servers from mysql_servers table. Shows hostgroup, hostname, port, status, and weights.",
    group: "proxysql",
    inputSchema: ProxySQLHostgroupInputSchemaBase,
    outputSchema: ProxySQLServersOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { hostgroup_id } = ProxySQLHostgroupInputSchema.parse(params);
        let sql = "SELECT * FROM mysql_servers";
        if (hostgroup_id !== undefined) {
          const safeId = Math.max(0, Math.floor(hostgroup_id));
          sql += ` WHERE hostgroup_id = ${safeId}`;
        }
        const rows = await proxySQLQuery(sql);
        return withTokenEstimate({
          success: true,
          data: {
            servers: rows,
            count: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// Query Tools
// =============================================================================

/**
 * List query routing rules
 */
function createProxySQLQueryRulesTool(): ToolDefinition {
  return {
    name: "proxysql_query_rules",
    title: "ProxySQL Query Rules",
    description:
      "List query routing rules from mysql_query_rules table. Shows rule IDs, match patterns, destination hostgroups, and cache settings.",
    group: "proxysql",
    inputSchema: ProxySQLLimitInputSchemaBase,
    outputSchema: ProxySQLQueryRulesOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit } = ProxySQLLimitInputSchema.parse(params);
        const maxRows = Math.max(0, Math.floor(limit ?? 20));
        const rows = await proxySQLQuery(
          `SELECT * FROM mysql_query_rules LIMIT ${maxRows}`,
        );
        return withTokenEstimate({
          success: true,
          data: {
            queryRules: rows,
            count: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * Get query digest statistics (top queries)
 */
function createProxySQLQueryDigestTool(): ToolDefinition {
  return {
    name: "proxysql_query_digest",
    title: "ProxySQL Query Digest",
    description:
      "Get query digest statistics showing top queries by execution count. Useful for identifying queries for routing, rewriting, or caching.",
    group: "proxysql",
    inputSchema: ProxySQLLimitInputSchemaBase,
    outputSchema: ProxySQLQueryDigestOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit } = ProxySQLLimitInputSchema.parse(params);
        const maxRows = Math.max(0, Math.floor(limit ?? 20));
        const rows = await proxySQLQuery(
          `SELECT hostgroup, schemaname, username, digest, digest_text, count_star, sum_time, min_time, max_time FROM stats_mysql_query_digest ORDER BY count_star DESC LIMIT ${maxRows}`,
        );
        return withTokenEstimate({
          success: true,
          data: {
            queryDigests: rows,
            count: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// Connection Pool Tools
// =============================================================================

/**
 * Get connection pool statistics per server
 */
function createProxySQLConnectionPoolTool(): ToolDefinition {
  return {
    name: "proxysql_connection_pool",
    title: "ProxySQL Connection Pool",
    description:
      "Get connection pool statistics per backend server. Shows connections used/free, errors, queries, bytes transferred, and latency.",
    group: "proxysql",
    inputSchema: ProxySQLHostgroupInputSchemaBase,
    outputSchema: ProxySQLConnectionPoolOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { hostgroup_id } = ProxySQLHostgroupInputSchema.parse(params);
        let sql = "SELECT * FROM stats_mysql_connection_pool";
        if (hostgroup_id !== undefined) {
          const safeId = Math.max(0, Math.floor(hostgroup_id));
          sql += ` WHERE hostgroup = ${safeId}`;
        }
        const rows = await proxySQLQuery(sql);
        return withTokenEstimate({
          success: true,
          data: {
            connectionPools: rows,
            count: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// User Tools
// =============================================================================

/**
 * List configured MySQL users
 */
function createProxySQLUsersTool(): ToolDefinition {
  return {
    name: "proxysql_users",
    title: "ProxySQL Users",
    description:
      "List configured MySQL users from mysql_users table. Shows username, active status, default hostgroup, and connection limits. Passwords are redacted.",
    group: "proxysql",
    inputSchema: ProxySQLBaseInputSchema,
    outputSchema: ProxySQLUsersOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        // Don't expose passwords, select specific columns
        const rows = await proxySQLQuery(
          "SELECT username, active, use_ssl, default_hostgroup, default_schema, transaction_persistent, max_connections, comment FROM mysql_users",
        );
        return withTokenEstimate({
          success: true,
          data: {
            users: rows,
            count: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// Variable Tools
// =============================================================================

/**
 * Get global variables (mysql-* and admin-*)
 */
function createProxySQLGlobalVariablesTool(): ToolDefinition {
  return {
    name: "proxysql_global_variables",
    title: "ProxySQL Global Variables",
    description:
      "Get ProxySQL global variables. Filter by prefix: mysql (MySQL proxy settings), admin (admin interface settings), or all. Use like parameter for pattern matching.",
    group: "proxysql",
    inputSchema: ProxySQLVariableFilterSchemaBase,
    outputSchema: ProxySQLGlobalVariablesOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { prefix, like, limit } =
          ProxySQLVariableFilterSchema.parse(params);
        const conditions: string[] = [];

        // Apply prefix filter
        if (prefix === "mysql") {
          conditions.push("variable_name LIKE 'mysql-%'");
        } else if (prefix === "admin") {
          conditions.push("variable_name LIKE 'admin-%'");
        }

        // Validate like pattern against safe character set
        if (like) {
          if (!LIKE_SAFE_RE.test(like)) {
            return {
              success: false,
              error: `Invalid like pattern: '${like}' — only alphanumeric, underscore, dash, dot, percent (%), and space characters are allowed`,
            };
          }
          const sanitizedLike = like.replace(/'/g, "''");
          conditions.push(`variable_name LIKE '${sanitizedLike}'`);
        }

        const whereClause =
          conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";

        // Get total count (without LIMIT) for truncation awareness
        const countRows = await proxySQLQuery(
          `SELECT COUNT(*) AS cnt FROM global_variables${whereClause}`,
        );
        const countRow = countRows[0] ?? { cnt: 0 };
        const totalVarsAvailable = Number(countRow["cnt"]);

        const maxRows = Math.max(0, Math.floor(limit ?? 10));
        const rows = await proxySQLQuery(
          `SELECT * FROM global_variables${whereClause} LIMIT ${maxRows}`,
        );

        // Redact sensitive credential values (passwords, credentials)
        const redactedRows = redactSensitiveVariables(rows);

        return withTokenEstimate({
          success: true,
          data: {
            variables: redactedRows,
            count: redactedRows.length,
            totalVarsAvailable,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// Memory Tools
// =============================================================================

/**
 * Get memory usage metrics
 */
function createProxySQLMemoryStatsTool(): ToolDefinition {
  return {
    name: "proxysql_memory_stats",
    title: "ProxySQL Memory Stats",
    description:
      "Get ProxySQL memory usage metrics from stats_memory_metrics. Shows memory for SQLite, auth, query digests, and more.",
    group: "proxysql",
    inputSchema: ProxySQLBaseInputSchema,
    outputSchema: ProxySQLMemoryStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const rows = await proxySQLQuery("SELECT * FROM stats_memory_metrics");
        return withTokenEstimate({
          success: true,
          data: {
            memoryStats: rows,
            count: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// Admin Command Tools
// =============================================================================

/**
 * Execute LOAD/SAVE commands
 */
function createProxySQLCommandsTool(): ToolDefinition {
  return {
    name: "proxysql_commands",
    title: "ProxySQL Commands",
    description:
      "Execute ProxySQL admin commands like LOAD/SAVE for users, servers, query rules, and variables. Also supports FLUSH commands.",
    group: "proxysql",
    inputSchema: ProxySQLCommandInputSchemaBase,
    outputSchema: ProxySQLCommandsOutputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { command } = ProxySQLCommandInputSchema.parse(params);
        await proxySQLQuery(command);
        return withTokenEstimate({
          success: true,
          data: {
            command,
            message: `Command executed: ${command}`,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

// =============================================================================
// Process List Tools
// =============================================================================

/**
 * Get active sessions like SHOW PROCESSLIST
 */
function createProxySQLProcessListTool(): ToolDefinition {
  return {
    name: "proxysql_process_list",
    title: "ProxySQL Process List",
    description:
      "Get active client sessions similar to MySQL SHOW PROCESSLIST. Shows session ID, user, database, client/server hosts, and current command.",
    group: "proxysql",
    inputSchema: ProxySQLLimitInputSchemaBase,
    outputSchema: ProxySQLProcessListOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit } = ProxySQLLimitInputSchema.parse(params);
        const maxRows = Math.max(0, Math.floor(limit ?? 20));
        const rows = await proxySQLQuery(
          `SELECT * FROM stats_mysql_processlist LIMIT ${maxRows}`,
        );
        return withTokenEstimate({
          success: true,
          data: {
            processes: rows,
            count: rows.length,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
