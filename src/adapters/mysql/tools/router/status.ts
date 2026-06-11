import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { withTokenEstimate } from "../core/error-helpers.js";
import {
  RouterBaseInputSchema,
  RouterStatusOutputSchema,
  RouterRoutesOutputSchema,
} from "../../schemas/router.js";
import { safeRouterFetch } from "./utils.js";

export function createRouterStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_status",
    title: "MySQL Router Status",
    description:
      "Get MySQL Router process status including version, hostname, and uptime. Requires Router REST API access.",
    group: "router",
    inputSchema: RouterBaseInputSchema,
    outputSchema: RouterStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      const result = await safeRouterFetch<unknown>("/router/status");
      if (!result.success) {
        return result.response;
      }
      return withTokenEstimate({
        success: true,
        data: result.data,
      });
    },
  };
}

export function createRouterRoutesTool(): ToolDefinition {
  return {
    name: "mysql_router_routes",
    title: "MySQL Router Routes",
    description:
      "List all configured routes in MySQL Router. Returns route names that can be used with other router tools.",
    group: "router",
    inputSchema: RouterBaseInputSchema,
    outputSchema: RouterRoutesOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (_params: unknown, _context: RequestContext) => {
      const result = await safeRouterFetch<unknown>("/routes");
      if (!result.success) {
        return result.response;
      }
      return withTokenEstimate({
        success: true,
        data: result.data,
      });
    },
  };
}
