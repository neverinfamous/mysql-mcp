import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  ProxySQLHostgroupInputSchema,
  ProxySQLHostgroupInputSchemaBase,
  ProxySQLServersOutputSchema,
  ProxySQLConnectionPoolOutputSchema,
} from "../../schemas/proxysql.js";
import { proxySQLQuery } from "./utils.js";

export function createProxySQLServersTool(): ToolDefinition {
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

export function createProxySQLConnectionPoolTool(): ToolDefinition {
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
