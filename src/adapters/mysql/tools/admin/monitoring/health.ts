import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ServerHealthOutputSchema } from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { z } from "zod";

export function createServerHealthTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_server_health",
    title: "MySQL Server Health",
    description: "Get comprehensive server health information.",
    group: "monitoring",
    inputSchema: schema,
    outputSchema: ServerHealthOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
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

        const response = {
          success: true,
          data: {
            serverHealth: {
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
