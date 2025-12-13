/**
 * MySQL Admin, Monitoring & Backup Tools
 * 
 * Database administration, monitoring, and backup operations.
 * 17 tools total (6 admin + 7 monitoring + 4 backup).
 */

/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    OptimizeTableSchema,
    AnalyzeTableSchema,
    CheckTableSchema,
    FlushTablesSchema,
    KillQuerySchema,
    ShowProcesslistSchema,
    ShowStatusSchema,
    ShowVariablesSchema,
    ExportTableSchema,
    ImportDataSchema
} from '../types.js';
import { z } from 'zod';

/**
 * Get admin tools
 */
export function getAdminTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createOptimizeTableTool(adapter),
        createAnalyzeTableTool(adapter),
        createCheckTableTool(adapter),
        createRepairTableTool(adapter),
        createFlushTablesTool(adapter),
        createKillQueryTool(adapter)
    ];
}

/**
 * Get monitoring tools
 */
export function getMonitoringTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createShowProcesslistTool(adapter),
        createShowStatusTool(adapter),
        createShowVariablesTool(adapter),
        createInnodbStatusTool(adapter),
        createReplicationStatusTool(adapter),
        createPoolStatsTool(adapter),
        createServerHealthTool(adapter)
    ];
}

/**
 * Get backup tools
 */
export function getBackupTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createExportTableTool(adapter),
        createImportDataTool(adapter),
        createCreateDumpTool(adapter),
        createRestoreDumpTool(adapter)
    ];
}

// =============================================================================
// Admin Tools
// =============================================================================

function createOptimizeTableTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_optimize_table',
        description: 'Optimize tables to reclaim unused space and defragment data.',
        group: 'admin',
        inputSchema: OptimizeTableSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { tables } = OptimizeTableSchema.parse(params);
            const tableList = tables.map(t => `\`${t}\``).join(', ');
            const result = await adapter.executeQuery(`OPTIMIZE TABLE ${tableList}`);
            return { results: result.rows };
        }
    };
}

function createAnalyzeTableTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_analyze_table',
        description: 'Analyze tables to update index statistics for the query optimizer.',
        group: 'admin',
        inputSchema: AnalyzeTableSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { tables } = AnalyzeTableSchema.parse(params);
            const tableList = tables.map(t => `\`${t}\``).join(', ');
            const result = await adapter.executeQuery(`ANALYZE TABLE ${tableList}`);
            return { results: result.rows };
        }
    };
}

function createCheckTableTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_check_table',
        description: 'Check tables for errors.',
        group: 'admin',
        inputSchema: CheckTableSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { tables, option } = CheckTableSchema.parse(params);
            const tableList = tables.map(t => `\`${t}\``).join(', ');
            const optionClause = option ? ` ${option}` : '';
            // Use rawQuery - CHECK TABLE not supported in prepared statement protocol
            const result = await adapter.rawQuery(`CHECK TABLE ${tableList}${optionClause}`);
            return {
                results: result.rows ?? [],
                rowCount: result.rows?.length ?? 0
            };
        }
    };
}

function createRepairTableTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        tables: z.array(z.string()),
        quick: z.boolean().optional().default(false)
    });

    return {
        name: 'mysql_repair_table',
        description: 'Repair corrupted tables (MyISAM only).',
        group: 'admin',
        inputSchema: schema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { tables, quick } = schema.parse(params);
            const tableList = tables.map(t => `\`${t}\``).join(', ');
            const quickClause = quick ? ' QUICK' : '';
            const result = await adapter.executeQuery(`REPAIR TABLE ${tableList}${quickClause}`);
            return { results: result.rows };
        }
    };
}

function createFlushTablesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_flush_tables',
        description: 'Flush tables to ensure data is written to disk.',
        group: 'admin',
        inputSchema: FlushTablesSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { tables } = FlushTablesSchema.parse(params);

            let sql = 'FLUSH TABLES';
            if (tables && tables.length > 0) {
                const tableList = tables.map(t => `\`${t}\``).join(', ');
                sql = `FLUSH TABLES ${tableList}`;
            }

            await adapter.executeQuery(sql);
            return { success: true };
        }
    };
}

function createKillQueryTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_kill_query',
        description: 'Kill a running query or connection.',
        group: 'admin',
        inputSchema: KillQuerySchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { processId, connection } = KillQuerySchema.parse(params);
            const killType = connection ? 'CONNECTION' : 'QUERY';
            await adapter.executeQuery(`KILL ${killType} ${processId}`);
            return { success: true, killed: processId, type: killType };
        }
    };
}

// =============================================================================
// Monitoring Tools
// =============================================================================

function createShowProcesslistTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_show_processlist',
        description: 'Show all running processes and queries.',
        group: 'monitoring',
        inputSchema: ShowProcesslistSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { full } = ShowProcesslistSchema.parse(params);
            const sql = full ? 'SHOW FULL PROCESSLIST' : 'SHOW PROCESSLIST';
            const result = await adapter.executeQuery(sql);
            return { processes: result.rows };
        }
    };
}

function createShowStatusTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_show_status',
        description: 'Show server status variables.',
        group: 'monitoring',
        inputSchema: ShowStatusSchema,
        requiredScopes: ['read'],
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

function createShowVariablesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_show_variables',
        description: 'Show server configuration variables.',
        group: 'monitoring',
        inputSchema: ShowVariablesSchema,
        requiredScopes: ['read'],
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

function createInnodbStatusTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_innodb_status',
        description: 'Get detailed InnoDB engine status.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            const result = await adapter.executeQuery('SHOW ENGINE INNODB STATUS');
            return { status: result.rows?.[0] };
        }
    };
}

function createReplicationStatusTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_replication_status',
        description: 'Show replication slave/replica status.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
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

function createPoolStatsTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_pool_stats',
        description: 'Get connection pool statistics.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (_params: unknown, _context: RequestContext) => {
            const pool = adapter.getPool();
            if (!pool) {
                return { error: 'Pool not available' };
            }
            return { poolStats: pool.getStats() };
        }
    };
}

function createServerHealthTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({});

    return {
        name: 'mysql_server_health',
        description: 'Get comprehensive server health information.',
        group: 'monitoring',
        inputSchema: schema,
        requiredScopes: ['read'],
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
                uptime: uptime ? parseInt(uptime as string, 10) : undefined,
                activeConnections: connections ? parseInt(connections as string, 10) : undefined,
                totalQueries: queries ? parseInt(queries as string, 10) : undefined
            };
        }
    };
}

// =============================================================================
// Backup Tools
// =============================================================================

function createExportTableTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_export_table',
        description: 'Export table data as SQL INSERT statements or CSV format.',
        group: 'backup',
        inputSchema: ExportTableSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, format, where } = ExportTableSchema.parse(params);

            // Get table data
            let sql = `SELECT * FROM \`${table}\``;
            if (where) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql);
            const rows = result.rows ?? [];

            if (format === 'CSV') {
                if (rows.length === 0) {
                    return { csv: '', rowCount: 0 };
                }

                const firstRow = rows[0];
                if (!firstRow) {
                    return { csv: '', rowCount: 0 };
                }

                const headers = Object.keys(firstRow);
                const csvLines = [headers.join(',')];

                for (const row of rows) {
                    const values = headers.map(h => {
                        const val = row[h];
                        if (val === null) return '';
                        // Handle objects (JSON columns) by stringifying them
                        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
                        return String(val);
                    });
                    csvLines.push(values.join(','));
                }

                return { csv: csvLines.join('\n'), rowCount: rows.length };
            }

            // SQL format
            const insertStatements: string[] = [];

            for (const row of rows) {
                const columns = Object.keys(row).map(c => `\`${c}\``).join(', ');
                const values = Object.values(row).map(v => {
                    if (v === null) return 'NULL';
                    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
                    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                    return String(v);
                }).join(', ');

                insertStatements.push(`INSERT INTO \`${table}\` (${columns}) VALUES (${values});`);
            }

            return { sql: insertStatements.join('\n'), rowCount: rows.length };
        }
    };
}

function createImportDataTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_import_data',
        description: 'Import data into a table from an array of row objects.',
        group: 'backup',
        inputSchema: ImportDataSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, data } = ImportDataSchema.parse(params);

            if (data.length === 0) {
                return { success: true, rowsInserted: 0 };
            }

            let totalInserted = 0;

            for (const row of data) {
                const columns = Object.keys(row).map(c => `\`${c}\``).join(', ');
                const placeholders = Object.keys(row).map(() => '?').join(', ');
                const values = Object.values(row);

                const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
                await adapter.executeWriteQuery(sql, values);
                totalInserted++;
            }

            return { success: true, rowsInserted: totalInserted };
        }
    };
}

function createCreateDumpTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        database: z.string().optional().describe('Database name (defaults to current)'),
        tables: z.array(z.string()).optional().describe('Specific tables to dump'),
        noData: z.boolean().optional().default(false).describe('Schema only, no data')
    });

    return {
        name: 'mysql_create_dump',
        description: 'Generate mysqldump command for backing up database.',
        group: 'backup',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { database, tables, noData } = schema.parse(params);

            // Get current database if not specified
            let dbName = database;
            if (!dbName) {
                const result = await adapter.executeReadQuery('SELECT DATABASE() as db');
                dbName = result.rows?.[0]?.['db'] as string;
            }

            let command = `mysqldump -u [username] -p ${dbName}`;

            if (tables && tables.length > 0) {
                command += ` ${tables.join(' ')}`;
            }

            if (noData) {
                command += ' --no-data';
            }

            command += ' > backup.sql';

            return {
                command,
                note: 'Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.'
            };
        }
    };
}

function createRestoreDumpTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        database: z.string().optional().describe('Target database'),
        filename: z.string().default('backup.sql').describe('Dump file to restore')
    });

    return {
        name: 'mysql_restore_dump',
        description: 'Generate command for restoring from mysqldump backup.',
        group: 'backup',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { database, filename } = schema.parse(params);

            let dbName = database;
            if (!dbName) {
                const result = await adapter.executeReadQuery('SELECT DATABASE() as db');
                dbName = result.rows?.[0]?.['db'] as string;
            }

            const command = `mysql -u [username] -p ${dbName} < ${filename}`;

            return {
                command,
                note: 'Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.'
            };
        }
    };
}
