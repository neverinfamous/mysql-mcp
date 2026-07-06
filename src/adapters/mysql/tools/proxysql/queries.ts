import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  ProxySQLLimitInputSchema,
  ProxySQLLimitInputSchemaBase,
  ProxySQLCommandInputSchema,
  ProxySQLCommandInputSchemaBase,
  ProxySQLQueryRulesOutputSchema,
  ProxySQLQueryDigestOutputSchema,
  ProxySQLCommandsOutputSchema,
} from "../../schemas/proxysql.js";
import { proxySQLQuery } from "./utils.js";

export function createProxySQLQueryRulesTool(): ToolDefinition {
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
      destructiveHint: false,
      sensitiveHint: false,
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

export function createProxySQLQueryDigestTool(): ToolDefinition {
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
      destructiveHint: false,
      sensitiveHint: false,
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

export function createProxySQLCommandsTool(): ToolDefinition {
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
      destructiveHint: false,
      sensitiveHint: false,
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
