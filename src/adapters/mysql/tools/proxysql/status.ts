import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import {
  ProxySQLStatusInputSchema,
  ProxySQLStatusInputSchemaBase,
  ProxySQLBaseInputSchema,
  ProxySQLStatusOutputSchema,
  ProxySQLRuntimeStatusOutputSchema,
  ProxySQLMemoryStatsOutputSchema,
} from "../../schemas/proxysql.js";
import { proxySQLQuery, redactSensitiveVariables } from "./utils.js";

export function createProxySQLStatusTool(): ToolDefinition {
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
        const version =
          typeof versionRow?.["variable_value"] === "string"
            ? versionRow["variable_value"]
            : "unknown";

        const uptimeRow = rows.find(
          (r) => r["Variable_Name"] === "ProxySQL_Uptime",
        );
        const uptime =
          typeof uptimeRow?.["Variable_Value"] === "string"
            ? uptimeRow["Variable_Value"]
            : "0";

        if (summary) {
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
          const filteredRows = rows.filter((row) => {
            const varName = row["Variable_Name"];
            return typeof varName === "string" && keyMetrics.includes(varName);
          });
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

export function createProxySQLRuntimeStatusTool(): ToolDefinition {
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

        const redactedVars = redactSensitiveVariables(adminVars);

        if (summary) {
          const keyAdminVars = [
            "admin-version",
            "admin-read_only",
            "admin-cluster_username",
            "admin-mysql_ifaces",
            "admin-restapi_enabled",
            "admin-web_enabled",
            "admin-stats_mysql_connection_pool",
          ];
          const filteredVars = redactedVars.filter((row) => {
            const varName = row["variable_name"];
            return typeof varName === "string" && keyAdminVars.includes(varName);
          });
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

export function createProxySQLMemoryStatsTool(): ToolDefinition {
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
