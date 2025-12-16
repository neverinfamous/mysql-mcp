/**
 * MySQL sys Schema Tools - Activity Monitoring
 * 
 * Tools for monitoring user and host activity.
 * 2 tools: user_summary, host_summary.
 */

import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const UserSummarySchema = z.object({
    user: z.string().optional().describe('Filter by specific user'),
    limit: z.number().default(20).describe('Maximum number of results')
});

const HostSummarySchema = z.object({
    host: z.string().optional().describe('Filter by specific host'),
    limit: z.number().default(20).describe('Maximum number of results')
});

/**
 * Get user activity summary
 */
export function createSysUserSummaryTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_sys_user_summary',
        title: 'MySQL User Summary',
        description: 'Get user activity summary including statements, connections, and latency from sys schema.',
        group: 'sysschema',
        inputSchema: UserSummarySchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { user, limit } = UserSummarySchema.parse(params);

            let query = `
                SELECT 
                    user,
                    statements,
                    statement_latency,
                    statement_avg_latency,
                    table_scans,
                    file_ios,
                    file_io_latency,
                    current_connections,
                    total_connections
                FROM sys.user_summary
            `;

            const queryParams: unknown[] = [];
            if (user) {
                query += ' WHERE user = ?';
                queryParams.push(user);
            }

            query += ` ORDER BY statement_latency DESC LIMIT ${String(limit)}`;

            const result = await adapter.executeQuery(query, queryParams);
            return {
                users: result.rows,
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Get host connection summary
 */
export function createSysHostSummaryTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_sys_host_summary',
        title: 'MySQL Host Summary',
        description: 'Get connection and activity summary by host from sys schema.',
        group: 'sysschema',
        inputSchema: HostSummarySchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { host, limit } = HostSummarySchema.parse(params);

            let query = `
                SELECT 
                    host,
                    statements,
                    statement_latency,
                    statement_avg_latency,
                    table_scans,
                    file_ios,
                    file_io_latency,
                    current_connections,
                    total_connections
                FROM sys.host_summary
            `;

            const queryParams: unknown[] = [];
            if (host) {
                query += ' WHERE host = ?';
                queryParams.push(host);
            }

            query += ` ORDER BY statement_latency DESC LIMIT ${String(limit)}`;

            const result = await adapter.executeQuery(query, queryParams);
            return {
                hosts: result.rows,
                count: result.rows?.length ?? 0
            };
        }
    };
}
