/**
 * MySQL Performance & Optimization Tools
 * 
 * Query analysis, EXPLAIN, and optimization tools.
 * 12 tools total (8 performance + 4 optimization).
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    ExplainSchema,
    SlowQuerySchema,
    IndexUsageSchema,
    TableStatsSchema
} from '../types.js';
import { z } from 'zod';

/**
 * Get performance analysis tools
 */
export function getPerformanceTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createExplainTool(adapter),
        createExplainAnalyzeTool(adapter),
        createSlowQueriesTool(adapter),
        createQueryStatsTool(adapter),
        createIndexUsageTool(adapter),
        createTableStatsTool(adapter),
        createBufferPoolStatsTool(adapter),
        createThreadStatsTool(adapter)
    ];
}

/**
 * Get optimization tools
 */
export function getOptimizationTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createIndexRecommendationTool(adapter),
        createQueryRewriteTool(adapter),
        createForceIndexTool(adapter),
        createOptimizerTraceTool(adapter)
    ];
}

// =============================================================================
// Performance Tools
// =============================================================================

function createExplainTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_explain',
        description: 'Get query execution plan using EXPLAIN.',
        group: 'performance',
        inputSchema: ExplainSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { query, format } = ExplainSchema.parse(params);

            const sql = format === 'JSON'
                ? `EXPLAIN FORMAT=JSON ${query}`
                : format === 'TREE'
                    ? `EXPLAIN FORMAT=TREE ${query}`
                    : `EXPLAIN ${query}`;

            const result = await adapter.executeReadQuery(sql);

            if (format === 'JSON' && result.rows?.[0]) {
                const jsonStr = result.rows[0]['EXPLAIN'] as string;
                return { plan: JSON.parse(jsonStr) };
            }

            return { plan: result.rows };
        }
    };
}

function createExplainAnalyzeTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        query: z.string().describe('SQL query to analyze'),
        format: z.enum(['JSON', 'TREE']).optional().default('TREE')
    });

    return {
        name: 'mysql_explain_analyze',
        description: 'Get query execution plan with actual timing using EXPLAIN ANALYZE (MySQL 8.0+).',
        group: 'performance',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { query, format } = schema.parse(params);

            const sql = `EXPLAIN ANALYZE FORMAT=${format} ${query}`;
            const result = await adapter.executeReadQuery(sql);

            if (format === 'JSON' && result.rows?.[0]) {
                const jsonStr = result.rows[0]['EXPLAIN'] as string;
                return { analysis: JSON.parse(jsonStr) };
            }

            return { analysis: result.rows };
        }
    };
}

function createSlowQueriesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_slow_queries',
        description: 'Get slow queries from performance_schema (if available).',
        group: 'performance',
        inputSchema: SlowQuerySchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { limit, minTime } = SlowQuerySchema.parse(params);

            let sql = `
                SELECT 
                    DIGEST_TEXT as query,
                    COUNT_STAR as executions,
                    AVG_TIMER_WAIT/1000000000 as avg_time_ms,
                    SUM_TIMER_WAIT/1000000000 as total_time_ms,
                    SUM_ROWS_EXAMINED as rows_examined,
                    SUM_ROWS_SENT as rows_sent
                FROM performance_schema.events_statements_summary_by_digest
            `;

            if (minTime) {
                sql += ` WHERE AVG_TIMER_WAIT > ${minTime * 1000000000}`;
            }

            sql += ` ORDER BY AVG_TIMER_WAIT DESC LIMIT ${limit}`;

            const result = await adapter.executeReadQuery(sql);
            return { slowQueries: result.rows };
        }
    };
}

function createQueryStatsTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        orderBy: z.enum(['total_time', 'avg_time', 'executions']).optional().default('total_time'),
        limit: z.number().optional().default(20)
    });

    return {
        name: 'mysql_query_stats',
        description: 'Get query statistics from performance_schema.',
        group: 'performance',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { orderBy, limit } = schema.parse(params);

            const orderColumn = {
                total_time: 'SUM_TIMER_WAIT',
                avg_time: 'AVG_TIMER_WAIT',
                executions: 'COUNT_STAR'
            }[orderBy];

            const sql = `
                SELECT 
                    SCHEMA_NAME as database_name,
                    DIGEST_TEXT as query_text,
                    COUNT_STAR as execution_count,
                    AVG_TIMER_WAIT/1000000000 as avg_time_ms,
                    MAX_TIMER_WAIT/1000000000 as max_time_ms,
                    SUM_TIMER_WAIT/1000000000 as total_time_ms,
                    SUM_ROWS_EXAMINED as total_rows_examined,
                    SUM_ROWS_SENT as total_rows_sent,
                    FIRST_SEEN as first_seen,
                    LAST_SEEN as last_seen
                FROM performance_schema.events_statements_summary_by_digest
                WHERE DIGEST_TEXT IS NOT NULL
                ORDER BY ${orderColumn} DESC
                LIMIT ${limit}
            `;

            const result = await adapter.executeReadQuery(sql);
            return { queries: result.rows };
        }
    };
}

function createIndexUsageTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_index_usage',
        description: 'Get index usage statistics from performance_schema.',
        group: 'performance',
        inputSchema: IndexUsageSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table } = IndexUsageSchema.parse(params);

            let sql = `
                SELECT 
                    object_schema as database_name,
                    object_name as table_name,
                    index_name,
                    count_read,
                    count_write,
                    count_fetch,
                    count_insert,
                    count_update,
                    count_delete
                FROM performance_schema.table_io_waits_summary_by_index_usage
                WHERE index_name IS NOT NULL
            `;

            if (table) {
                sql += ` AND object_name = ?`;
            }

            sql += ` ORDER BY count_read + count_write DESC`;

            const result = await adapter.executeReadQuery(sql, table ? [table] : []);
            return { indexUsage: result.rows };
        }
    };
}

function createTableStatsTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_table_stats',
        description: 'Get detailed table statistics including size, rows, and engine info.',
        group: 'performance',
        inputSchema: TableStatsSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table } = TableStatsSchema.parse(params);

            const sql = `
                SELECT 
                    TABLE_NAME as table_name,
                    ENGINE as engine,
                    ROW_FORMAT as row_format,
                    TABLE_ROWS as estimated_rows,
                    AVG_ROW_LENGTH as avg_row_length,
                    DATA_LENGTH as data_size_bytes,
                    INDEX_LENGTH as index_size_bytes,
                    DATA_FREE as free_space_bytes,
                    AUTO_INCREMENT as auto_increment,
                    CREATE_TIME as create_time,
                    UPDATE_TIME as update_time,
                    TABLE_COLLATION as collation
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
            `;

            const result = await adapter.executeReadQuery(sql, [table]);
            return { stats: result.rows?.[0] };
        }
    };
}

function createBufferPoolStatsTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_buffer_pool_stats',
        description: 'Get InnoDB buffer pool statistics.',
        group: 'performance',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            // Use SELECT * for compatibility across MySQL versions
            // Different MySQL versions have different column sets
            const result = await adapter.executeReadQuery(
                `SELECT * FROM information_schema.INNODB_BUFFER_POOL_STATS`
            );

            return { bufferPoolStats: result.rows };
        }
    };
}

function createThreadStatsTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_thread_stats',
        description: 'Get thread activity statistics.',
        group: 'performance',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            const result = await adapter.executeReadQuery(`
                SELECT 
                    THREAD_ID,
                    NAME,
                    TYPE,
                    PROCESSLIST_ID,
                    PROCESSLIST_USER,
                    PROCESSLIST_HOST,
                    PROCESSLIST_DB,
                    PROCESSLIST_COMMAND,
                    PROCESSLIST_TIME,
                    PROCESSLIST_STATE,
                    CONNECTION_TYPE
                FROM performance_schema.threads
                WHERE PROCESSLIST_ID IS NOT NULL
                ORDER BY PROCESSLIST_TIME DESC
            `);

            return { threads: result.rows };
        }
    };
}

// =============================================================================
// Optimization Tools
// =============================================================================

function createIndexRecommendationTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string().describe('Table to analyze for missing indexes')
    });

    return {
        name: 'mysql_index_recommendation',
        description: 'Analyze table and suggest potentially missing indexes based on query patterns.',
        group: 'optimization',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table } = schema.parse(params);

            // Get columns
            const columns = await adapter.describeTable(table);

            // Get existing indexes
            const indexes = await adapter.getTableIndexes(table);
            const indexedColumns = new Set(indexes.flatMap(i => i.columns));

            // Analyze which columns might benefit from indexing
            const recommendations: { column: string; reason: string }[] = [];

            for (const col of columns.columns ?? []) {
                if (indexedColumns.has(col.name)) continue;

                // Suggest indexes for common patterns
                if (col.name.endsWith('_id') || col.name === 'id') {
                    recommendations.push({
                        column: col.name,
                        reason: 'Foreign key or ID column often benefits from indexing'
                    });
                } else if (['created_at', 'updated_at', 'date', 'timestamp'].some(s => col.name.includes(s))) {
                    recommendations.push({
                        column: col.name,
                        reason: 'Timestamp columns often used in range queries'
                    });
                } else if (col.name === 'status' || col.name === 'type' || col.name === 'category') {
                    recommendations.push({
                        column: col.name,
                        reason: 'Status/type columns often used in filtering'
                    });
                }
            }

            return {
                table,
                existingIndexes: indexes.map(i => ({ name: i.name, columns: i.columns })),
                recommendations
            };
        }
    };
}

function createQueryRewriteTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        query: z.string().describe('SQL query to analyze for optimization')
    });

    return {
        name: 'mysql_query_rewrite',
        description: 'Analyze a query and suggest optimizations.',
        group: 'optimization',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { query } = schema.parse(params);

            const suggestions: string[] = [];
            const upperQuery = query.toUpperCase();

            // Basic query analysis
            if (upperQuery.includes('SELECT *')) {
                suggestions.push('Consider selecting only needed columns instead of SELECT *');
            }

            if (!upperQuery.includes('LIMIT') && upperQuery.includes('SELECT')) {
                suggestions.push('Consider adding LIMIT to prevent large result sets');
            }

            if (upperQuery.includes('LIKE') && query.includes('%')) {
                if (query.includes("LIKE '%")) {
                    suggestions.push('Leading wildcard in LIKE prevents index usage; consider FULLTEXT search');
                }
            }

            if (upperQuery.includes('OR')) {
                suggestions.push('OR conditions may prevent index usage; consider UNION instead');
            }

            if (upperQuery.includes('ORDER BY') && !upperQuery.includes('LIMIT')) {
                suggestions.push('ORDER BY without LIMIT may cause full table sort');
            }

            if (upperQuery.includes('NOT IN') || upperQuery.includes('NOT EXISTS')) {
                suggestions.push('NOT IN/NOT EXISTS can be slow; consider LEFT JOIN with NULL check');
            }

            // Get EXPLAIN for the query
            let explainResult;
            try {
                const explainSql = `EXPLAIN FORMAT=JSON ${query}`;
                const result = await adapter.executeReadQuery(explainSql);
                if (result.rows?.[0]) {
                    explainResult = JSON.parse(result.rows[0]['EXPLAIN'] as string);
                }
            } catch {
                // Ignore explain errors
            }

            return {
                originalQuery: query,
                suggestions,
                explainPlan: explainResult
            };
        }
    };
}

function createForceIndexTool(_adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        query: z.string().describe('Original query'),
        indexName: z.string().describe('Index name to force')
    });

    return {
        name: 'mysql_force_index',
        description: 'Generate a query with FORCE INDEX hint.',
        group: 'optimization',
        inputSchema: schema,
        requiredScopes: ['read'],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, query, indexName } = schema.parse(params);

            // Simple replacement - insert FORCE INDEX after table name
            const rewritten = query.replace(
                new RegExp(`FROM\\s+\`?${table}\`?`, 'i'),
                `FROM \`${table}\` FORCE INDEX (\`${indexName}\`)`
            );

            return {
                originalQuery: query,
                rewrittenQuery: rewritten,
                hint: `FORCE INDEX (\`${indexName}\`)`
            };
        }
    };
}

function createOptimizerTraceTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        query: z.string().describe('Query to trace')
    });

    return {
        name: 'mysql_optimizer_trace',
        description: 'Get detailed optimizer trace for a query.',
        group: 'optimization',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { query } = schema.parse(params);

            // Enable optimizer trace
            await adapter.executeQuery('SET optimizer_trace="enabled=on"');

            try {
                // Execute the query
                await adapter.executeReadQuery(query);

                // Get the trace
                const traceResult = await adapter.executeReadQuery(
                    'SELECT * FROM information_schema.OPTIMIZER_TRACE'
                );

                return { trace: traceResult.rows };
            } finally {
                // Disable optimizer trace
                await adapter.executeQuery('SET optimizer_trace="enabled=off"');
            }
        }
    };
}
