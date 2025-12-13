/**
 * MySQL Core Database Tools
 * 
 * Fundamental database operations: read, write, table management, indexes.
 * 8 tools total.
 */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    ReadQuerySchema,
    WriteQuerySchema,
    CreateTableSchema,
    DescribeTableSchema,
    DropTableSchema,
    CreateIndexSchema,
    GetIndexesSchema,
    ListTablesSchema
} from '../types.js';

/**
 * Get all core database tools
 */
export function getCoreTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createReadQueryTool(adapter),
        createWriteQueryTool(adapter),
        createListTablesTool(adapter),
        createDescribeTableTool(adapter),
        createCreateTableTool(adapter),
        createDropTableTool(adapter),
        createGetIndexesTool(adapter),
        createCreateIndexTool(adapter)
    ];
}

/**
 * Execute a read-only SQL query
 */
function createReadQueryTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_read_query',
        description: 'Execute a read-only SQL query (SELECT). Uses prepared statements for safety.',
        group: 'core',
        inputSchema: ReadQuerySchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { query, params: queryParams } = ReadQuerySchema.parse(params);
            const result = await adapter.executeReadQuery(query, queryParams);
            return {
                rows: result.rows,
                rowCount: result.rows?.length ?? 0,
                executionTimeMs: result.executionTimeMs
            };
        }
    };
}

/**
 * Execute a write SQL query
 */
function createWriteQueryTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_write_query',
        description: 'Execute a write SQL query (INSERT, UPDATE, DELETE). Uses prepared statements for safety.',
        group: 'core',
        inputSchema: WriteQuerySchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { query, params: queryParams } = WriteQuerySchema.parse(params);
            const result = await adapter.executeWriteQuery(query, queryParams);
            return {
                rowsAffected: result.rowsAffected,
                lastInsertId: result.lastInsertId?.toString(),
                executionTimeMs: result.executionTimeMs
            };
        }
    };
}

/**
 * List all tables in the database
 */
function createListTablesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_list_tables',
        description: 'List all tables and views in the database with metadata.',
        group: 'core',
        inputSchema: ListTablesSchema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            const tables = await adapter.listTables();
            return {
                tables: tables.map(t => ({
                    name: t.name,
                    type: t.type,
                    engine: t.engine,
                    rowCount: t.rowCount,
                    comment: t.comment
                })),
                count: tables.length
            };
        }
    };
}

/**
 * Describe a table's structure
 */
function createDescribeTableTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_describe_table',
        description: 'Get detailed information about a table\'s structure including columns, types, and constraints.',
        group: 'core',
        inputSchema: DescribeTableSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table } = DescribeTableSchema.parse(params);
            const tableInfo = await adapter.describeTable(table);
            return tableInfo;
        }
    };
}

/**
 * Create a new table
 */
function createCreateTableTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_create_table',
        description: 'Create a new table with specified columns, engine, and charset.',
        group: 'core',
        inputSchema: CreateTableSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const {
                name,
                columns,
                engine,
                charset,
                collate,
                comment,
                ifNotExists
            } = CreateTableSchema.parse(params);

            // Build column definitions
            const columnDefs = columns.map(col => {
                let def = `\`${col.name}\` ${col.type}`;

                if (!col.nullable) {
                    def += ' NOT NULL';
                }
                if (col.autoIncrement) {
                    def += ' AUTO_INCREMENT';
                }
                if (col.default !== undefined) {
                    // Check if default is a SQL function/expression that should not be quoted
                    const defaultValue = String(col.default).toUpperCase().trim();
                    const sqlFunctions = [
                        'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME',
                        'NOW()', 'UUID()', 'NULL'
                    ];
                    const isSqlFunction = sqlFunctions.some(fn => defaultValue.startsWith(fn)) ||
                        /^[A-Z_]+\(.*\)$/.test(defaultValue); // Matches FUNCTION(...) pattern

                    if (isSqlFunction || typeof col.default === 'number') {
                        def += ` DEFAULT ${col.default}`;
                    } else {
                        def += ` DEFAULT '${String(col.default).replace(/'/g, "''")}'`;
                    }
                }
                if (col.unique) {
                    def += ' UNIQUE';
                }
                if (col.comment) {
                    def += ` COMMENT '${col.comment.replace(/'/g, "''")}'`;
                }

                return def;
            });

            // Add primary key
            const pkCols = columns.filter(c => c.primaryKey).map(c => `\`${c.name}\``);
            if (pkCols.length > 0) {
                columnDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
            }

            // Build SQL
            const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : '';
            let sql = `CREATE TABLE ${ifNotExistsClause}\`${name}\` (\n  ${columnDefs.join(',\n  ')}\n)`;
            sql += ` ENGINE=${engine}`;
            sql += ` DEFAULT CHARSET=${charset}`;
            sql += ` COLLATE=${collate}`;

            if (comment) {
                sql += ` COMMENT='${comment.replace(/'/g, "''")}'`;
            }

            await adapter.executeQuery(sql);

            return { success: true, tableName: name };
        }
    };
}

/**
 * Drop a table
 */
function createDropTableTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_drop_table',
        description: 'Drop (delete) a table from the database.',
        group: 'core',
        inputSchema: DropTableSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, ifExists } = DropTableSchema.parse(params);

            // Validate table name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
                throw new Error('Invalid table name');
            }

            const ifExistsClause = ifExists ? 'IF EXISTS ' : '';
            await adapter.executeQuery(`DROP TABLE ${ifExistsClause}\`${table}\``);

            return { success: true, tableName: table };
        }
    };
}

/**
 * Get indexes for a table
 */
function createGetIndexesTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_get_indexes',
        description: 'Get all indexes for a table including type, columns, and cardinality.',
        group: 'core',
        inputSchema: GetIndexesSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table } = GetIndexesSchema.parse(params);
            const indexes = await adapter.getTableIndexes(table);
            return { indexes };
        }
    };
}

/**
 * Create an index
 */
function createCreateIndexTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_create_index',
        description: 'Create an index on a table. Supports BTREE, HASH, FULLTEXT, and SPATIAL index types.',
        group: 'core',
        inputSchema: CreateIndexSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, table, columns, unique, type, ifNotExists } = CreateIndexSchema.parse(params);

            // Validate names
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
                throw new Error('Invalid index name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
                throw new Error('Invalid table name');
            }

            const columnList = columns.map(c => `\`${c}\``).join(', ');
            const uniqueClause = unique ? 'UNIQUE ' : '';
            const typeClause = type ? `USING ${type} ` : '';

            // Note: IF NOT EXISTS not supported for indexes in MySQL
            // We'll check if it exists first
            if (ifNotExists) {
                const existing = await adapter.getTableIndexes(table);
                if (existing.some(idx => idx.name === name)) {
                    return { success: true, skipped: true, indexName: name, reason: 'Index already exists' };
                }
            }

            await adapter.executeQuery(
                `CREATE ${uniqueClause}INDEX \`${name}\` ${typeClause}ON \`${table}\` (${columnList})`
            );

            return { success: true, indexName: name };
        }
    };
}
