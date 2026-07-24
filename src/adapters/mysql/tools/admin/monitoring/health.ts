import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ServerHealthSchema, ServerHealthSchemaBase, ServerHealthOutputSchema } from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createServerHealthTool(adapter: MySQLAdapter): ToolDefinition {

  return {
    name: "mysql_server_health",
    title: "MySQL Server Health",
    description: "Get comprehensive server health information.",
    group: "monitoring",
    inputSchema: ServerHealthSchemaBase,
    outputSchema: ServerHealthOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = ServerHealthSchema.parse(params);
        const health = await adapter.getHealth();

        if (summary || !health.connected) {
          const response = {
            success: true,
            data: {
              serverHealth: {
                connected: health.connected,
                latencyMs: health.latencyMs,
                version: health.version,
                error: health.error,
              },
              summary: true
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return { ...response, metrics: { tokenEstimate } };
        }

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

        const response = {
          success: true,
          data: {
            serverHealth: {
              ...health,
              uptime:
                uptime != null
                  ? typeof uptime === "string"
                    ? parseInt(uptime, 10)
                    : typeof uptime === "number"
                      ? uptime
                      : undefined
                  : undefined,
              activeConnections:
                connections != null
                  ? typeof connections === "string"
                    ? parseInt(connections, 10)
                    : typeof connections === "number"
                      ? connections
                      : undefined
                  : undefined,
              totalQueries:
                queries != null
                  ? typeof queries === "string"
                    ? parseInt(queries, 10)
                    : typeof queries === "number"
                      ? queries
                      : undefined
                  : undefined,
            },
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
