import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  ProxySQLBaseInputSchema,
  ProxySQLVariableFilterSchema,
  ProxySQLVariableFilterSchemaBase,
  ProxySQLLimitInputSchema,
  ProxySQLLimitInputSchemaBase,
  ProxySQLUsersOutputSchema,
  ProxySQLGlobalVariablesOutputSchema,
  ProxySQLProcessListOutputSchema,
} from "../../schemas/proxysql.js";
import { proxySQLQuery, redactSensitiveVariables, LIKE_SAFE_RE } from "./utils.js";

export function createProxySQLUsersTool(): ToolDefinition {
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

export function createProxySQLGlobalVariablesTool(): ToolDefinition {
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

        if (prefix === "mysql") {
          conditions.push("variable_name LIKE 'mysql-%'");
        } else if (prefix === "admin") {
          conditions.push("variable_name LIKE 'admin-%'");
        }

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

        const countRows = await proxySQLQuery(
          `SELECT COUNT(*) AS cnt FROM global_variables${whereClause}`,
        );
        const countRow = countRows[0] ?? { cnt: 0 };
        const totalVarsAvailable = Number(countRow["cnt"]);

        const maxRows = Math.max(0, Math.floor(limit ?? 10));
        const rows = await proxySQLQuery(
          `SELECT * FROM global_variables${whereClause} LIMIT ${maxRows}`,
        );

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

export function createProxySQLProcessListTool(): ToolDefinition {
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
