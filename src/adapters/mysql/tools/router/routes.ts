import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import {
  RouteNameInputSchema,
  RouteNameInputSchemaBase,
  RouterRouteStatusOutputSchema,
  RouterRouteHealthOutputSchema,
  RouterRouteConnectionsOutputSchema,
  RouterRouteDestinationsOutputSchema,
  RouterRouteBlockedHostsOutputSchema,
} from "../../schemas/router.js";
import { safeRouterFetch } from "./utils.js";

export function createRouterRouteStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_route_status",
    title: "MySQL Router Route Status",
    description:
      "Get operational status of a specific route including active connections, total connections, and blocked hosts count.",
    group: "router",
    inputSchema: RouteNameInputSchemaBase,
    outputSchema: RouterRouteStatusOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { routeName } = RouteNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/routes/${encodeURIComponent(routeName)}/status`,
        );
        if (!result.success) {
          return result.response;
        }
        return withTokenEstimate({
          success: true,
          data: {
            routeName,
            status: result.data,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createRouterRouteHealthTool(): ToolDefinition {
  return {
    name: "mysql_router_route_health",
    title: "MySQL Router Route Health",
    description:
      "Check if a route is alive and functioning. Returns isAlive boolean indicating route health.",
    group: "router",
    inputSchema: RouteNameInputSchemaBase,
    outputSchema: RouterRouteHealthOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { routeName } = RouteNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/routes/${encodeURIComponent(routeName)}/health`,
        );
        if (!result.success) {
          return result.response;
        }
        return withTokenEstimate({
          success: true,
          data: {
            routeName,
            health: result.data,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createRouterRouteConnectionsTool(): ToolDefinition {
  return {
    name: "mysql_router_route_connections",
    title: "MySQL Router Route Connections",
    description:
      "List active connections on a route including source/destination addresses, bytes transferred, and connection times.",
    group: "router",
    inputSchema: RouteNameInputSchemaBase,
    outputSchema: RouterRouteConnectionsOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { routeName } = RouteNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/routes/${encodeURIComponent(routeName)}/connections`,
        );
        if (!result.success) {
          return result.response;
        }
        return withTokenEstimate({
          success: true,
          data: {
            routeName,
            connections: result.data,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createRouterRouteDestinationsTool(): ToolDefinition {
  return {
    name: "mysql_router_route_destinations",
    title: "MySQL Router Route Destinations",
    description:
      "List backend MySQL server destinations for a route. Shows address and port of each destination server.",
    group: "router",
    inputSchema: RouteNameInputSchemaBase,
    outputSchema: RouterRouteDestinationsOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { routeName } = RouteNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/routes/${encodeURIComponent(routeName)}/destinations`,
        );
        if (!result.success) {
          return result.response;
        }
        return withTokenEstimate({
          success: true,
          data: {
            routeName,
            destinations: result.data,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createRouterRouteBlockedHostsTool(): ToolDefinition {
  return {
    name: "mysql_router_route_blocked_hosts",
    title: "MySQL Router Blocked Hosts",
    description:
      "List IP addresses that have been blocked for a route due to too many failed connection attempts.",
    group: "router",
    inputSchema: RouteNameInputSchemaBase,
    outputSchema: RouterRouteBlockedHostsOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { routeName } = RouteNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/routes/${encodeURIComponent(routeName)}/blockedHosts`,
        );
        if (!result.success) {
          return result.response;
        }
        return withTokenEstimate({
          success: true,
          data: {
            routeName,
            blockedHosts: result.data,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
