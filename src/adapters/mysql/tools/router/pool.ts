import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import {
  ConnectionPoolNameInputSchema,
  ConnectionPoolNameInputSchemaBase,
  RouterPoolStatusOutputSchema,
} from "../../schemas/router.js";
import { safeRouterFetch } from "./utils.js";

export function createRouterPoolStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_pool_status",
    title: "MySQL Router Pool Status",
    description:
      "Get MySQL Router connection pool status including idle and stashed server connections.",
    group: "router",
    inputSchema: ConnectionPoolNameInputSchemaBase,
    outputSchema: RouterPoolStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { poolName } = ConnectionPoolNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/connection_pool/${encodeURIComponent(poolName)}/status`,
        );
        if (!result.success) {
          return result.response;
        }
        return withTokenEstimate({
          success: true,
          data: {
            poolName,
            status: result.data,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
