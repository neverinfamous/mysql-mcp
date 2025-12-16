/**
 * MySQL Admin Tools - Monitoring
 * 
 * Tools for server and performance monitoring.
 * 7 tools: processlist, status, variables, innodb_status, replication, pool_stats, health.
 */

import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import {
    ShowProcesslistSchema,
    ShowStatusSchema,
    ShowVariablesSchema
} from '../../types.js';
import { z } from 'zod';

export function createShowProcesslistTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_show_processlist',
        title: 'MySQL Show Processlist',
        description: 'Show all running processes and queries.',
        group: 'monitoring',
        inputSchema: ShowProcesslistSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { full } = ShowProcesslistSchema.parse(params);
            const sql = full ? 'SHOW FULL PROCESSLIST' : 'SHOW PROCESSLIST';
            const result = await adapter.executeQuery(sql);
            return { processes: result.rows };
        }
    };
}

export function createShowStatusTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_show_status',
        title: 'MySQL Show Status',
        description: 'Show server status variables.',
        group: 'monitoring',
        inputSchema: ShowStatusSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { like, global } = ShowStatusSchema.parse(params);

            let sql = global ? 'SHOW GLOBAL STATUS' : 'SHOW STATUS';

            // SHOW commands don't support parameter binding - build SQL directly
            if (like) {
                // Escape the like pattern for safety
                const escapedLike = like.replace(/'/g, "''");
                sql += ` LIKE '${escapedLike}'`;
            }

            const result = await adapter.rawQuery(sql);

            // Convert to object for easier use
            // Handle both uppercase and Pascal case column names
            const status: Record<string, string> = {};
            for (const row of result.rows ?? []) {
                const name = (row['Variable_name'] ?? row['VARIABLE_NAME'] ?? row['variable_name']) as string;
                const value = (row['Value'] ?? row['VALUE'] ?? row['value']) as string;
                if (name) {
                    status[name] = value;
                }
            }

            return { status, rowCount: result.rows?.length ?? 0 };
        }
    };
}

export function createShowVariablesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_show_variables',
        title: 'MySQL Show Variables',
        description: 'Show server configuration variables.',
        group: 'monitoring',
        inputSchema: ShowVariablesSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { like, global } = ShowVariablesSchema.parse(params);

            let sql = global ? 'SHOW GLOBAL VARIABLES' : 'SHOW VARIABLES';

            // SHOW commands don't support parameter binding - build SQL directly
            if (like) {
                // Escape the like pattern for safety
                const escapedLike = like.replace(/'/g, "''");
                sql += ` LIKE '${escapedLike}'`;
            }

            const result = await adapter.rawQuery(sql);

            // Convert to object
            // Handle both uppercase and Pascal case column names
            const variables: Record<string, string> = {};
            for (const row of result.rows ?? []) {
                const name = (row['Variable_name'] ?? row['VARIABLE_NAME'] ?? row['variable_name']) as string;
                const value = (row['Value'] ?? row['VALUE'] ?? row['value']) as string;
                if (name) {
                    variables[name] = value;
                }
            }

            return { variables, rowCount: result.rows?.length ?? 0 };
        }
    };
}

export function createInnodbStatusTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_innodb_status',
        title: 'MySQL InnoDB Status',
        description: 'Get detailed InnoDB engine status.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const result = await adapter.executeQuery('SHOW ENGINE INNODB STATUS');
            return { status: result.rows?.[0] };
        }
    };
}

export function createReplicationStatusTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_replication_status',
        title: 'MySQL Replication Status',
        description: 'Show replication slave/replica status.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            // Try both old and new syntax
            try {
                const result = await adapter.executeQuery('SHOW REPLICA STATUS');
                return { status: result.rows?.[0] };
            } catch {
                const result = await adapter.executeQuery('SHOW SLAVE STATUS');
                return { status: result.rows?.[0] };
            }
        }
    };
}

export function createPoolStatsTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_pool_stats',
        title: 'MySQL Pool Stats',
        description: 'Get connection pool statistics.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const pool = await Promise.resolve(adapter.getPool());
            if (!pool) {
                return { error: 'Pool not available' };
            }
            return { poolStats: pool.getStats() };
        }
    };
}

export function createServerHealthTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_server_health',
        title: 'MySQL Server Health',
        description: 'Get comprehensive server health information.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (_params: unknown, _context: RequestContext) => {
            const health = await adapter.getHealth();

            // Get additional metrics
            const uptimeResult = await adapter.executeQuery("SHOW GLOBAL STATUS LIKE 'Uptime'");
            const uptime = uptimeResult.rows?.[0]?.['Value'];

            const connectionsResult = await adapter.executeQuery("SHOW GLOBAL STATUS LIKE 'Threads_connected'");
            const connections = connectionsResult.rows?.[0]?.['Value'];

            const queriesResult = await adapter.executeQuery("SHOW GLOBAL STATUS LIKE 'Questions'");
            const queries = queriesResult.rows?.[0]?.['Value'];

            return {
                ...health,
                uptime: (uptime != null && typeof uptime === 'string') ? parseInt(uptime, 10) : undefined,
                activeConnections: (connections != null && typeof connections === 'string') ? parseInt(connections, 10) : undefined,
                totalQueries: (queries != null && typeof queries === 'string') ? parseInt(queries, 10) : undefined
            };
        }
    };
}
