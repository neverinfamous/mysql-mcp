/**
 * MySQL Router Management Tools
 *
 * Tools for monitoring and managing MySQL Router via its REST API.
 * 9 tools total.
 *
 * Router REST API documentation:
 * https://dev.mysql.com/doc/mysql-router/8.0/en/mysql-router-rest-api.html
 */

import type {
  ToolDefinition,
  RequestContext,
  RouterConfig,
} from "../../../types/index.js";
import type { MySQLAdapter } from "../MySQLAdapter.js";
import https from "node:https";
import { ZodError } from "zod";
import {
  RouterBaseInputSchema,
  RouteNameInputSchema,
  MetadataNameInputSchema,
  ConnectionPoolNameInputSchema,
} from "../types/router-types.js";

// =============================================================================
// Helpers
// =============================================================================

/** Extract human-readable messages from a ZodError instead of raw JSON array */
function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

// =============================================================================
// Router HTTP Client Helper
// =============================================================================

/**
 * Response type for graceful Router API unavailability
 */
interface RouterUnavailableResponse {
  available: false;
  error: string;
}

/**
 * Result type for safe Router API calls
 */
type SafeRouterResult<T> =
  | { success: true; data: T }
  | { success: false; response: RouterUnavailableResponse };

/**
 * Get Router configuration from environment variables
 */
function getRouterConfig(): RouterConfig {
  return {
    url: process.env["MYSQL_ROUTER_URL"] ?? "https://localhost:8443",
    username: process.env["MYSQL_ROUTER_USER"] ?? "",
    password: process.env["MYSQL_ROUTER_PASSWORD"] ?? "",
    insecure: process.env["MYSQL_ROUTER_INSECURE"] === "true",
    apiVersion: process.env["MYSQL_ROUTER_API_VERSION"] ?? "/api/20190715",
  };
}

/**
 * Fetch data from MySQL Router REST API using native https module.
 *
 * Note: We use the https module instead of fetch() because Node.js native fetch
 * uses undici under the hood, which doesn't support the rejectUnauthorized option
 * in the same way as https.Agent. This ensures proper handling of self-signed
 * certificates when MYSQL_ROUTER_INSECURE=true.
 */
async function routerFetch(
  path: string,
  config?: RouterConfig,
): Promise<unknown> {
  const cfg = config ?? getRouterConfig();
  const baseUrl = cfg.url ?? "https://localhost:8443";
  const apiVersion = cfg.apiVersion ?? "/api/20190715";
  const username = cfg.username ?? "";
  const password = cfg.password ?? "";
  const insecure = cfg.insecure ?? false;

  const fullUrl = `${baseUrl}${apiVersion}${path}`;
  const parsedUrl = new URL(fullUrl);

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (username && password) {
      const auth = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    // Build request options
    // SECURITY NOTE: rejectUnauthorized=false is INTENTIONAL for development/testing
    // environments where MySQL Router uses self-signed certificates. It is only
    // activated when the user explicitly sets MYSQL_ROUTER_INSECURE=true.
    // In production, users should configure proper TLS certificates on MySQL Router.
    // @see https://dev.mysql.com/doc/mysql-router/8.0/en/mysql-router-conf-options.html#option_mysqlrouter_server_ssl_key
    const requestOptions: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 8443,
      path: parsedUrl.pathname,
      method: "GET",
      headers,
      // CodeQL: This is intentional - see SECURITY NOTE above
      // nosemgrep: nodejs.lang.security.audit.tls-connection-insecure.tls-connection-insecure
      rejectUnauthorized: !insecure, // codeql-ignore js/disabling-certificate-validation
      timeout: 10000, // 10 second timeout
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        const statusCode = res.statusCode ?? 0;
        if (statusCode >= 200 && statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        } else {
          reject(
            new Error(
              `Router API error: ${statusCode} ${res.statusMessage ?? "Unknown"}`,
            ),
          );
        }
      });
    });

    req.on("error", (error) => {
      // Provide more descriptive error messages for common connection issues
      const errorCode = (error as NodeJS.ErrnoException).code;
      let message = error.message;
      if (errorCode === "ECONNREFUSED") {
        message = `Connection refused - MySQL Router REST API is not reachable at ${baseUrl}`;
      } else if (errorCode === "ETIMEDOUT" || errorCode === "ESOCKETTIMEDOUT") {
        message = `Connection timed out - MySQL Router REST API at ${baseUrl} is not responding`;
      } else if (errorCode === "ENOTFOUND") {
        message = `Host not found - cannot resolve ${parsedUrl.hostname}`;
      } else if (
        errorCode === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
        errorCode === "CERT_HAS_EXPIRED" ||
        errorCode === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
        error.message.includes("self-signed") ||
        error.message.includes("certificate")
      ) {
        message = `TLS certificate error: ${error.message}. Set MYSQL_ROUTER_INSECURE=true for self-signed certificates`;
      }
      reject(new Error(`Router API request failed: ${message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(
        new Error(
          `Router API request timed out after 10 seconds - MySQL Router at ${baseUrl} is not responding`,
        ),
      );
    });

    req.end();
  });
}

/**
 * Safe wrapper for routerFetch that returns graceful responses instead of throwing.
 * Returns { success: true, data } on success or { success: false, response: { available: false, reason } } on failure.
 */
async function safeRouterFetch<T>(path: string): Promise<SafeRouterResult<T>> {
  try {
    const data = (await routerFetch(path)) as T;
    return { success: true, data };
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : "Unknown error connecting to Router API";
    return {
      success: false,
      response: {
        available: false,
        error: msg,
      },
    };
  }
}

// =============================================================================
// Tool Registration
// =============================================================================

/**
 * Get all Router management tools
 */
export function getRouterTools(_adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createRouterStatusTool(),
    createRouterRoutesTool(),
    createRouterRouteStatusTool(),
    createRouterRouteHealthTool(),
    createRouterRouteConnectionsTool(),
    createRouterRouteDestinationsTool(),
    createRouterRouteBlockedHostsTool(),
    createRouterMetadataStatusTool(),
    createRouterPoolStatusTool(),
  ];
}

// =============================================================================
// Router Status Tools
// =============================================================================

/**
 * Get MySQL Router status
 */
function createRouterStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_status",
    title: "MySQL Router Status",
    description:
      "Get MySQL Router process status including version, hostname, and uptime. Requires Router REST API access.",
    group: "router",
    inputSchema: RouterBaseInputSchema,
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
      return {
        success: true,
        status: result.data,
      };
    },
  };
}

/**
 * List all configured routes
 */
function createRouterRoutesTool(): ToolDefinition {
  return {
    name: "mysql_router_routes",
    title: "MySQL Router Routes",
    description:
      "List all configured routes in MySQL Router. Returns route names that can be used with other router tools.",
    group: "router",
    inputSchema: RouterBaseInputSchema,
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
      return {
        success: true,
        routes: result.data,
      };
    },
  };
}

// =============================================================================
// Route-Specific Tools
// =============================================================================

/**
 * Get status of a specific route
 */
function createRouterRouteStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_route_status",
    title: "MySQL Router Route Status",
    description:
      "Get operational status of a specific route including active connections, total connections, and blocked hosts count.",
    group: "router",
    inputSchema: RouteNameInputSchema,
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
        return {
          success: true,
          routeName,
          status: result.data,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Check health of a specific route
 */
function createRouterRouteHealthTool(): ToolDefinition {
  return {
    name: "mysql_router_route_health",
    title: "MySQL Router Route Health",
    description:
      "Check if a route is alive and functioning. Returns isAlive boolean indicating route health.",
    group: "router",
    inputSchema: RouteNameInputSchema,
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
        return {
          success: true,
          routeName,
          health: result.data,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * List active connections on a route
 */
function createRouterRouteConnectionsTool(): ToolDefinition {
  return {
    name: "mysql_router_route_connections",
    title: "MySQL Router Route Connections",
    description:
      "List active connections on a route including source/destination addresses, bytes transferred, and connection times.",
    group: "router",
    inputSchema: RouteNameInputSchema,
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
        return {
          success: true,
          routeName,
          connections: result.data,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * List backend destinations for a route
 */
function createRouterRouteDestinationsTool(): ToolDefinition {
  return {
    name: "mysql_router_route_destinations",
    title: "MySQL Router Route Destinations",
    description:
      "List backend MySQL server destinations for a route. Shows address and port of each destination server.",
    group: "router",
    inputSchema: RouteNameInputSchema,
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
        return {
          success: true,
          routeName,
          destinations: result.data,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * List blocked hosts for a route
 */
function createRouterRouteBlockedHostsTool(): ToolDefinition {
  return {
    name: "mysql_router_route_blocked_hosts",
    title: "MySQL Router Blocked Hosts",
    description:
      "List IP addresses that have been blocked for a route due to too many failed connection attempts.",
    group: "router",
    inputSchema: RouteNameInputSchema,
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
        return {
          success: true,
          routeName,
          blockedHosts: result.data,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

// =============================================================================
// Metadata Cache Tools
// =============================================================================

/**
 * Get metadata cache status
 */
function createRouterMetadataStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_metadata_status",
    title: "MySQL Router Metadata Status",
    description:
      "Get InnoDB Cluster metadata cache status including refresh statistics and last refresh host.",
    group: "router",
    inputSchema: MetadataNameInputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { metadataName } = MetadataNameInputSchema.parse(params);
        const result = await safeRouterFetch<unknown>(
          `/metadata/${encodeURIComponent(metadataName)}/status`,
        );
        if (!result.success) {
          return result.response;
        }
        return {
          success: true,
          metadataName,
          status: result.data,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

// =============================================================================
// Connection Pool Tools
// =============================================================================

/**
 * Get connection pool status
 */
function createRouterPoolStatusTool(): ToolDefinition {
  return {
    name: "mysql_router_pool_status",
    title: "MySQL Router Pool Status",
    description:
      "Get MySQL Router connection pool status including idle and stashed server connections.",
    group: "router",
    inputSchema: ConnectionPoolNameInputSchema,
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
        return {
          success: true,
          poolName,
          status: result.data,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
