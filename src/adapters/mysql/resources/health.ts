/**
 * MySQL Resource - Health
 * 
 * Comprehensive database health status including connection pool,
 * thread activity, and InnoDB status.
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createHealthResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://health',
        name: 'Database Health',
        title: 'MySQL Database Health',
        description: 'Comprehensive database health status',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 1.0
        },
        handler: async (_uri: string, _context: RequestContext) => {
            // Get uptime and connection info
            const statusResult = await adapter.executeQuery(`
                SHOW GLOBAL STATUS WHERE Variable_name IN (
                    'Uptime', 'Threads_connected', 'Threads_running', 
                    'Max_used_connections', 'Connections', 'Aborted_connects',
                    'Slow_queries', 'Questions', 'Com_select', 'Com_insert',
                    'Com_update', 'Com_delete', 'Innodb_buffer_pool_read_requests',
                    'Innodb_buffer_pool_reads', 'Table_locks_waited', 'Table_locks_immediate'
                )
            `);

            const status: Record<string, string> = {};
            for (const row of statusResult.rows ?? []) {
                status[row['Variable_name'] as string] = row['Value'] as string;
            }

            // Get max_connections for percentage calculation
            const maxConnResult = await adapter.executeQuery(
                "SHOW GLOBAL VARIABLES LIKE 'max_connections'"
            );
            const maxConnections = parseInt(
                (maxConnResult.rows?.[0]?.['Value'] as string) ?? '151',
                10
            );

            // Calculate health metrics
            const threadsConnected = parseInt(status['Threads_connected'] ?? '0', 10);
            const connectionUsagePercent = Math.round((threadsConnected / maxConnections) * 100);

            const bufferPoolRequests = parseInt(status['Innodb_buffer_pool_read_requests'] ?? '0', 10);
            const bufferPoolReads = parseInt(status['Innodb_buffer_pool_reads'] ?? '0', 10);
            const bufferPoolHitRatio = bufferPoolRequests > 0
                ? Math.round(((bufferPoolRequests - bufferPoolReads) / bufferPoolRequests) * 100 * 100) / 100
                : 100;

            const tableLockWaited = parseInt(status['Table_locks_waited'] ?? '0', 10);
            const tableLockImmediate = parseInt(status['Table_locks_immediate'] ?? '0', 10);
            const tableLockContention = (tableLockWaited + tableLockImmediate) > 0
                ? Math.round((tableLockWaited / (tableLockWaited + tableLockImmediate)) * 100 * 100) / 100
                : 0;

            // Get connection pool stats if available
            const pool = adapter.getPool();
            const poolStats = pool?.getStats();

            return {
                status: 'healthy',
                uptime_seconds: parseInt(status['Uptime'] ?? '0', 10),
                connections: {
                    current: threadsConnected,
                    running: parseInt(status['Threads_running'] ?? '0', 10),
                    max_used: parseInt(status['Max_used_connections'] ?? '0', 10),
                    max_allowed: maxConnections,
                    usage_percent: connectionUsagePercent
                },
                performance: {
                    questions: parseInt(status['Questions'] ?? '0', 10),
                    slow_queries: parseInt(status['Slow_queries'] ?? '0', 10),
                    buffer_pool_hit_ratio: bufferPoolHitRatio,
                    table_lock_contention_percent: tableLockContention
                },
                queries: {
                    select: parseInt(status['Com_select'] ?? '0', 10),
                    insert: parseInt(status['Com_insert'] ?? '0', 10),
                    update: parseInt(status['Com_update'] ?? '0', 10),
                    delete: parseInt(status['Com_delete'] ?? '0', 10)
                },
                pool: poolStats ?? null
            };
        }
    };
}
