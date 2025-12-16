/**
 * MySQL Router Management Tools
 * 
 * Tools for monitoring and managing MySQL Router via its REST API.
 * 9 tools total.
 * 
 * Router REST API documentation:
 * https://dev.mysql.com/doc/mysql-router/8.0/en/mysql-router-rest-api.html
 */

import type { ToolDefinition, RequestContext, RouterConfig } from '../../../types/index.js';
import type { MySQLAdapter } from '../MySQLAdapter.js';
import https from 'node:https';
import {
    RouterBaseInputSchema,
    RouteNameInputSchema,
    MetadataNameInputSchema,
    ConnectionPoolNameInputSchema
} from '../types/router-types.js';

// =============================================================================
// Router HTTP Client Helper
// =============================================================================

/**
 * Lazily-initialized HTTPS agent for insecure mode (self-signed certificates).
 * 
 * SECURITY NOTE: This is an INTENTIONAL feature for development/testing environments
 * where MySQL Router uses self-signed certificates. It is only activated when the user
 * explicitly sets MYSQL_ROUTER_INSECURE=true. In production, users should configure
 * proper TLS certificates on MySQL Router.
 * 
 * @see https://dev.mysql.com/doc/mysql-router/8.0/en/mysql-router-conf-options.html#option_mysqlrouter_server_ssl_key
 */
let _insecureAgent: https.Agent | null = null;
function getInsecureAgent(): https.Agent {
    // CodeQL: This is intentional - see SECURITY NOTE above
    // nosemgrep: nodejs.lang.security.audit.tls-connection-insecure.tls-connection-insecure
    _insecureAgent ??= new https.Agent({
        rejectUnauthorized: false // codeql-ignore js/disabling-certificate-validation
    });
    return _insecureAgent;
}

/**
 * Get Router configuration from environment variables
 */
function getRouterConfig(): RouterConfig {
    return {
        url: process.env['MYSQL_ROUTER_URL'] ?? 'https://localhost:8443',
        username: process.env['MYSQL_ROUTER_USER'] ?? '',
        password: process.env['MYSQL_ROUTER_PASSWORD'] ?? '',
        insecure: process.env['MYSQL_ROUTER_INSECURE'] === 'true',
        apiVersion: process.env['MYSQL_ROUTER_API_VERSION'] ?? '/api/20190715'
    };
}

/**
 * Fetch data from MySQL Router REST API
 */
async function routerFetch(
    path: string,
    config?: RouterConfig
): Promise<unknown> {
    const cfg = config ?? getRouterConfig();
    const baseUrl = cfg.url ?? 'https://localhost:8443';
    const apiVersion = cfg.apiVersion ?? '/api/20190715';
    const username = cfg.username ?? '';
    const password = cfg.password ?? '';
    const insecure = cfg.insecure ?? false;

    const url = `${baseUrl}${apiVersion}${path}`;
    const headers: Record<string, string> = {
        'Accept': 'application/json'
    };

    if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
    }

    // Build fetch options - use custom agent for insecure mode to handle self-signed certs
    // lgtm[js/disabling-certificate-validation] - Intentional for development/testing with self-signed certs
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
        method: 'GET',
        headers
    };

    if (insecure && baseUrl.startsWith('https://')) {
        console.error('WARNING: TLS certificate validation disabled for Router API request. This is insecure and should only be used for development/testing.');
        // Use undici dispatcher for Node.js fetch with custom TLS settings
        // @ts-expect-error - Node.js fetch supports dispatcher option via undici
        fetchOptions.dispatcher = getInsecureAgent();
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        throw new Error(`Router API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
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
        createRouterPoolStatusTool()
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
        name: 'mysql_router_status',
        title: 'MySQL Router Status',
        description: 'Get MySQL Router process status including version, hostname, and uptime. Requires Router REST API access.',
        group: 'router',
        inputSchema: RouterBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const result = await routerFetch('/router/status');
            return {
                success: true,
                status: result
            };
        }
    };
}

/**
 * List all configured routes
 */
function createRouterRoutesTool(): ToolDefinition {
    return {
        name: 'mysql_router_routes',
        title: 'MySQL Router Routes',
        description: 'List all configured routes in MySQL Router. Returns route names that can be used with other router tools.',
        group: 'router',
        inputSchema: RouterBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const result = await routerFetch('/routes');
            return {
                success: true,
                routes: result
            };
        }
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
        name: 'mysql_router_route_status',
        title: 'MySQL Router Route Status',
        description: 'Get operational status of a specific route including active connections, total connections, and blocked hosts count.',
        group: 'router',
        inputSchema: RouteNameInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { routeName } = RouteNameInputSchema.parse(params);
            const result = await routerFetch(`/routes/${encodeURIComponent(routeName)}/status`);
            return {
                success: true,
                routeName,
                status: result
            };
        }
    };
}

/**
 * Check health of a specific route
 */
function createRouterRouteHealthTool(): ToolDefinition {
    return {
        name: 'mysql_router_route_health',
        title: 'MySQL Router Route Health',
        description: 'Check if a route is alive and functioning. Returns isAlive boolean indicating route health.',
        group: 'router',
        inputSchema: RouteNameInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { routeName } = RouteNameInputSchema.parse(params);
            const result = await routerFetch(`/routes/${encodeURIComponent(routeName)}/health`);
            return {
                success: true,
                routeName,
                health: result
            };
        }
    };
}

/**
 * List active connections on a route
 */
function createRouterRouteConnectionsTool(): ToolDefinition {
    return {
        name: 'mysql_router_route_connections',
        title: 'MySQL Router Route Connections',
        description: 'List active connections on a route including source/destination addresses, bytes transferred, and connection times.',
        group: 'router',
        inputSchema: RouteNameInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { routeName } = RouteNameInputSchema.parse(params);
            const result = await routerFetch(`/routes/${encodeURIComponent(routeName)}/connections`);
            return {
                success: true,
                routeName,
                connections: result
            };
        }
    };
}

/**
 * List backend destinations for a route
 */
function createRouterRouteDestinationsTool(): ToolDefinition {
    return {
        name: 'mysql_router_route_destinations',
        title: 'MySQL Router Route Destinations',
        description: 'List backend MySQL server destinations for a route. Shows address and port of each destination server.',
        group: 'router',
        inputSchema: RouteNameInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { routeName } = RouteNameInputSchema.parse(params);
            const result = await routerFetch(`/routes/${encodeURIComponent(routeName)}/destinations`);
            return {
                success: true,
                routeName,
                destinations: result
            };
        }
    };
}

/**
 * List blocked hosts for a route
 */
function createRouterRouteBlockedHostsTool(): ToolDefinition {
    return {
        name: 'mysql_router_route_blocked_hosts',
        title: 'MySQL Router Blocked Hosts',
        description: 'List IP addresses that have been blocked for a route due to too many failed connection attempts.',
        group: 'router',
        inputSchema: RouteNameInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { routeName } = RouteNameInputSchema.parse(params);
            const result = await routerFetch(`/routes/${encodeURIComponent(routeName)}/blockedHosts`);
            return {
                success: true,
                routeName,
                blockedHosts: result
            };
        }
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
        name: 'mysql_router_metadata_status',
        title: 'MySQL Router Metadata Status',
        description: 'Get InnoDB Cluster metadata cache status including refresh statistics and last refresh host.',
        group: 'router',
        inputSchema: MetadataNameInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { metadataName } = MetadataNameInputSchema.parse(params);
            const result = await routerFetch(`/metadata/${encodeURIComponent(metadataName)}/status`);
            return {
                success: true,
                metadataName,
                status: result
            };
        }
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
        name: 'mysql_router_pool_status',
        title: 'MySQL Router Pool Status',
        description: 'Get MySQL Router connection pool status including reused connections and idle server connections.',
        group: 'router',
        inputSchema: ConnectionPoolNameInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { poolName } = ConnectionPoolNameInputSchema.parse(params);
            const result = await routerFetch(`/connection_pool/${encodeURIComponent(poolName)}/status`);
            return {
                success: true,
                poolName,
                status: result
            };
        }
    };
}
