/**
 * ProxySQL Management Tools
 * 
 * Tools for monitoring and managing ProxySQL via its MySQL-protocol admin interface.
 * 12 tools total.
 * 
 * ProxySQL admin interface documentation:
 * https://proxysql.com/documentation/ProxySQL-Admin-Interface/
 */

import mysql from 'mysql2/promise';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import type { MySQLAdapter } from '../MySQLAdapter.js';
import {
    ProxySQLBaseInputSchema,
    ProxySQLLimitInputSchema,
    ProxySQLHostgroupInputSchema,
    ProxySQLVariableFilterSchema,
    ProxySQLCommandInputSchema,
    type ProxySQLConfig
} from '../types/proxysql-types.js';

// =============================================================================
// ProxySQL Connection Helper
// =============================================================================

/**
 * Get ProxySQL configuration from environment variables
 */
function getProxySQLConfig(): ProxySQLConfig {
    return {
        host: process.env['PROXYSQL_HOST'] ?? 'localhost',
        port: parseInt(process.env['PROXYSQL_PORT'] ?? '6032', 10),
        user: process.env['PROXYSQL_USER'] ?? 'admin',
        password: process.env['PROXYSQL_PASSWORD'] ?? 'admin'
    };
}

/**
 * Execute a query on ProxySQL admin interface
 */
async function proxySQLQuery(
    sql: string,
    config?: ProxySQLConfig
): Promise<Record<string, unknown>[]> {
    const cfg = config ?? getProxySQLConfig();

    const connection = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password
    });

    try {
        const [rows] = await connection.query(sql);
        return rows as Record<string, unknown>[];
    } finally {
        await connection.end();
    }
}

// =============================================================================
// Tool Registration
// =============================================================================

/**
 * Get all ProxySQL management tools
 */
export function getProxySQLTools(_adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createProxySQLStatusTool(),
        createProxySQLServersTool(),
        createProxySQLHostgroupsTool(),
        createProxySQLQueryRulesTool(),
        createProxySQLQueryDigestTool(),
        createProxySQLConnectionPoolTool(),
        createProxySQLUsersTool(),
        createProxySQLGlobalVariablesTool(),
        createProxySQLRuntimeStatusTool(),
        createProxySQLMemoryStatsTool(),
        createProxySQLCommandsTool(),
        createProxySQLProcessListTool()
    ];
}

// =============================================================================
// Status Tools
// =============================================================================

/**
 * Get ProxySQL status and version info
 */
function createProxySQLStatusTool(): ToolDefinition {
    return {
        name: 'proxysql_status',
        title: 'ProxySQL Status',
        description: 'Get ProxySQL version, uptime, and runtime statistics. Returns global status variables from stats_mysql_global.',
        group: 'proxysql',
        inputSchema: ProxySQLBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const rows = await proxySQLQuery('SELECT * FROM stats_mysql_global');
            return {
                success: true,
                stats: rows
            };
        }
    };
}

/**
 * Get ProxySQL runtime status
 */
function createProxySQLRuntimeStatusTool(): ToolDefinition {
    return {
        name: 'proxysql_runtime_status',
        title: 'ProxySQL Runtime Status',
        description: 'Get ProxySQL runtime configuration status including version info and admin variables.',
        group: 'proxysql',
        inputSchema: ProxySQLBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const [versionRow] = await proxySQLQuery("SELECT variable_value FROM global_variables WHERE variable_name = 'admin-version'");
            const adminVars = await proxySQLQuery("SELECT * FROM global_variables WHERE variable_name LIKE 'admin-%' LIMIT 20");
            return {
                success: true,
                version: versionRow?.['variable_value'] ?? 'unknown',
                adminVariables: adminVars
            };
        }
    };
}

// =============================================================================
// Server and Hostgroup Tools
// =============================================================================

/**
 * List configured backend MySQL servers
 */
function createProxySQLServersTool(): ToolDefinition {
    return {
        name: 'proxysql_servers',
        title: 'ProxySQL Servers',
        description: 'List configured backend MySQL servers from mysql_servers table. Shows hostgroup, hostname, port, status, and weights.',
        group: 'proxysql',
        inputSchema: ProxySQLHostgroupInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { hostgroup_id } = ProxySQLHostgroupInputSchema.parse(params);
            let sql = 'SELECT * FROM mysql_servers';
            if (hostgroup_id !== undefined) {
                sql += ` WHERE hostgroup_id = ${hostgroup_id}`;
            }
            const rows = await proxySQLQuery(sql);
            return {
                success: true,
                servers: rows,
                count: rows.length
            };
        }
    };
}

/**
 * List hostgroup configurations and connection pool stats
 */
function createProxySQLHostgroupsTool(): ToolDefinition {
    return {
        name: 'proxysql_hostgroups',
        title: 'ProxySQL Hostgroups',
        description: 'List hostgroup configurations with connection pool statistics. Shows connections used/free, query counts, and latency.',
        group: 'proxysql',
        inputSchema: ProxySQLBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const rows = await proxySQLQuery('SELECT * FROM stats_mysql_connection_pool');
            return {
                success: true,
                hostgroups: rows
            };
        }
    };
}

// =============================================================================
// Query Tools
// =============================================================================

/**
 * List query routing rules
 */
function createProxySQLQueryRulesTool(): ToolDefinition {
    return {
        name: 'proxysql_query_rules',
        title: 'ProxySQL Query Rules',
        description: 'List query routing rules from mysql_query_rules table. Shows rule IDs, match patterns, destination hostgroups, and cache settings.',
        group: 'proxysql',
        inputSchema: ProxySQLLimitInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { limit } = ProxySQLLimitInputSchema.parse(params);
            const maxRows = limit ?? 100;
            const rows = await proxySQLQuery(`SELECT * FROM mysql_query_rules LIMIT ${maxRows}`);
            return {
                success: true,
                queryRules: rows,
                count: rows.length
            };
        }
    };
}

/**
 * Get query digest statistics (top queries)
 */
function createProxySQLQueryDigestTool(): ToolDefinition {
    return {
        name: 'proxysql_query_digest',
        title: 'ProxySQL Query Digest',
        description: 'Get query digest statistics showing top queries by execution count. Useful for identifying queries for routing, rewriting, or caching.',
        group: 'proxysql',
        inputSchema: ProxySQLLimitInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { limit } = ProxySQLLimitInputSchema.parse(params);
            const maxRows = limit ?? 50;
            const rows = await proxySQLQuery(`SELECT hostgroup, schemaname, username, digest, digest_text, count_star, sum_time, min_time, max_time FROM stats_mysql_query_digest ORDER BY count_star DESC LIMIT ${maxRows}`);
            return {
                success: true,
                queryDigests: rows,
                count: rows.length
            };
        }
    };
}

// =============================================================================
// Connection Pool Tools
// =============================================================================

/**
 * Get connection pool statistics per server
 */
function createProxySQLConnectionPoolTool(): ToolDefinition {
    return {
        name: 'proxysql_connection_pool',
        title: 'ProxySQL Connection Pool',
        description: 'Get connection pool statistics per backend server. Shows connections used/free, errors, queries, bytes transferred, and latency.',
        group: 'proxysql',
        inputSchema: ProxySQLHostgroupInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { hostgroup_id } = ProxySQLHostgroupInputSchema.parse(params);
            let sql = 'SELECT * FROM stats_mysql_connection_pool';
            if (hostgroup_id !== undefined) {
                sql += ` WHERE hostgroup = ${hostgroup_id}`;
            }
            const rows = await proxySQLQuery(sql);
            return {
                success: true,
                connectionPools: rows,
                count: rows.length
            };
        }
    };
}

// =============================================================================
// User Tools
// =============================================================================

/**
 * List configured MySQL users
 */
function createProxySQLUsersTool(): ToolDefinition {
    return {
        name: 'proxysql_users',
        title: 'ProxySQL Users',
        description: 'List configured MySQL users from mysql_users table. Shows username, active status, default hostgroup, and connection limits. Passwords are redacted.',
        group: 'proxysql',
        inputSchema: ProxySQLBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            // Don't expose passwords, select specific columns
            const rows = await proxySQLQuery('SELECT username, active, use_ssl, default_hostgroup, default_schema, transaction_persistent, max_connections, comment FROM mysql_users');
            return {
                success: true,
                users: rows,
                count: rows.length
            };
        }
    };
}

// =============================================================================
// Variable Tools
// =============================================================================

/**
 * Get global variables (mysql-* and admin-*)
 */
function createProxySQLGlobalVariablesTool(): ToolDefinition {
    return {
        name: 'proxysql_global_variables',
        title: 'ProxySQL Global Variables',
        description: 'Get ProxySQL global variables. Filter by prefix: mysql (MySQL proxy settings), admin (admin interface settings), or all.',
        group: 'proxysql',
        inputSchema: ProxySQLVariableFilterSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { prefix } = ProxySQLVariableFilterSchema.parse(params);
            let sql = 'SELECT * FROM global_variables';
            if (prefix === 'mysql') {
                sql += " WHERE variable_name LIKE 'mysql-%'";
            } else if (prefix === 'admin') {
                sql += " WHERE variable_name LIKE 'admin-%'";
            }
            const rows = await proxySQLQuery(sql);
            return {
                success: true,
                variables: rows,
                count: rows.length
            };
        }
    };
}

// =============================================================================
// Memory Tools
// =============================================================================

/**
 * Get memory usage metrics
 */
function createProxySQLMemoryStatsTool(): ToolDefinition {
    return {
        name: 'proxysql_memory_stats',
        title: 'ProxySQL Memory Stats',
        description: 'Get ProxySQL memory usage metrics from stats_memory_metrics. Shows memory for SQLite, auth, query digests, and more.',
        group: 'proxysql',
        inputSchema: ProxySQLBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const rows = await proxySQLQuery('SELECT * FROM stats_memory_metrics');
            return {
                success: true,
                memoryStats: rows
            };
        }
    };
}

// =============================================================================
// Admin Command Tools
// =============================================================================

/**
 * Execute LOAD/SAVE commands
 */
function createProxySQLCommandsTool(): ToolDefinition {
    return {
        name: 'proxysql_commands',
        title: 'ProxySQL Commands',
        description: 'Execute ProxySQL admin commands like LOAD/SAVE for users, servers, query rules, and variables. Also supports FLUSH commands.',
        group: 'proxysql',
        inputSchema: ProxySQLCommandInputSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: false,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { command } = ProxySQLCommandInputSchema.parse(params);
            await proxySQLQuery(command);
            return {
                success: true,
                command,
                message: `Command executed: ${command}`
            };
        }
    };
}

// =============================================================================
// Process List Tools
// =============================================================================

/**
 * Get active sessions like SHOW PROCESSLIST
 */
function createProxySQLProcessListTool(): ToolDefinition {
    return {
        name: 'proxysql_process_list',
        title: 'ProxySQL Process List',
        description: 'Get active client sessions similar to MySQL SHOW PROCESSLIST. Shows session ID, user, database, client/server hosts, and current command.',
        group: 'proxysql',
        inputSchema: ProxySQLBaseInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const rows = await proxySQLQuery('SELECT * FROM stats_mysql_processlist');
            return {
                success: true,
                processes: rows,
                count: rows.length
            };
        }
    };
}
