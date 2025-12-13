/**
 * mysql-mcp - MySQL Adapter
 * 
 * Main MySQL database adapter with connection pooling,
 * query execution, and tool registration.
 */

import type { PoolConnection } from 'mysql2/promise';
import { DatabaseAdapter } from '../DatabaseAdapter.js';
import { ConnectionPool } from '../../pool/ConnectionPool.js';
import type {
    DatabaseConfig,
    QueryResult,
    SchemaInfo,
    TableInfo,
    ColumnInfo,
    IndexInfo,
    HealthStatus,
    AdapterCapabilities,
    ToolDefinition,
    ResourceDefinition,
    PromptDefinition,
    ToolGroup
} from '../../types/index.js';
import { ConnectionError, QueryError, ValidationError, TransactionError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

// Import tool modules
import { getCoreTools } from './tools/core.js';
import { getTransactionTools } from './tools/transactions.js';
import { getJsonTools, getJsonHelperTools } from './tools/json.js';
import { getTextTools, getFulltextTools } from './tools/text.js';
import { getPerformanceTools, getOptimizationTools } from './tools/performance.js';
import { getAdminTools, getMonitoringTools, getBackupTools } from './tools/admin.js';
import { getReplicationTools, getPartitioningTools } from './tools/replication.js';
import { getRouterTools } from './tools/router.js';
import { getMySQLResources } from './resources/index.js';
import { getMySQLPrompts } from './prompts/index.js';

/**
 * MySQL Database Adapter
 */
export class MySQLAdapter extends DatabaseAdapter {
    readonly type = 'mysql' as const;
    readonly name = 'MySQL Adapter';
    readonly version = '0.1.0';

    private pool: ConnectionPool | null = null;
    private activeTransactions = new Map<string, PoolConnection>();

    // =========================================================================
    // Connection Lifecycle
    // =========================================================================

    async connect(config: DatabaseConfig): Promise<void> {
        if (this.connected) {
            logger.warn('Already connected');
            return;
        }

        // Build pool configuration
        const poolConfig = {
            host: config.host ?? 'localhost',
            port: config.port ?? 3306,
            user: config.username ?? 'root',
            password: config.password ?? '',
            database: config.database ?? '',
            pool: config.pool,
            ssl: config.options?.ssl as boolean | undefined,
            charset: config.options?.charset ?? 'utf8mb4',
            timezone: config.options?.timezone ?? 'local',
            connectTimeout: config.options?.connectTimeout ?? 10000
        };

        this.pool = new ConnectionPool(poolConfig);

        try {
            await this.pool.initialize();
            this.connected = true;
            logger.info('MySQL adapter connected', {
                host: poolConfig.host,
                port: poolConfig.port,
                database: poolConfig.database
            });
        } catch (error) {
            this.pool = null;
            throw new ConnectionError(`Failed to connect: ${String(error)}`);
        }
    }

    async disconnect(): Promise<void> {
        if (!this.connected || !this.pool) {
            return;
        }

        // Close any active transactions
        for (const [id, conn] of this.activeTransactions) {
            try {
                await conn.rollback();
                conn.release();
                logger.warn(`Rolled back orphaned transaction: ${id}`);
            } catch {
                // Ignore errors during cleanup
            }
        }
        this.activeTransactions.clear();

        await this.pool.shutdown();
        this.pool = null;
        this.connected = false;
        logger.info('MySQL adapter disconnected');
    }

    async getHealth(): Promise<HealthStatus> {
        if (!this.pool) {
            return {
                connected: false,
                error: 'Not connected'
            };
        }

        return this.pool.checkHealth();
    }

    // =========================================================================
    // Query Execution
    // =========================================================================

    async executeReadQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.validateQuery(sql, true);
        return this.executeQuery(sql, params);
    }

    async executeWriteQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.validateQuery(sql, false);
        return this.executeQuery(sql, params);
    }

    async executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        if (!this.pool) {
            throw new ConnectionError('Not connected to database');
        }

        const startTime = Date.now();

        try {
            const [results, fields] = await this.pool.execute(sql, params);

            const executionTimeMs = Date.now() - startTime;

            // Handle SELECT results
            if (Array.isArray(results)) {
                return {
                    rows: results as Record<string, unknown>[],
                    executionTimeMs,
                    columns: fields?.map(f => ({
                        name: f.name,
                        type: this.getTypeName(f.type ?? 0)
                    }))
                };
            }

            // Handle INSERT/UPDATE/DELETE results
            const resultInfo = results as {
                affectedRows?: number;
                insertId?: number | bigint;
                warningStatus?: number;
            };

            return {
                rowsAffected: resultInfo.affectedRows,
                lastInsertId: resultInfo.insertId,
                warningCount: resultInfo.warningStatus,
                executionTimeMs
            };
        } catch (error) {
            const err = error as Error;
            throw new QueryError(`Query failed: ${err.message}`, { sql });
        }
    }

    /**
     * Execute a query on a specific connection (for transactions)
     */
    async executeOnConnection(
        connection: PoolConnection,
        sql: string,
        params?: unknown[]
    ): Promise<QueryResult> {
        const startTime = Date.now();

        try {
            const [results, fields] = await connection.execute(sql, params);

            const executionTimeMs = Date.now() - startTime;

            if (Array.isArray(results)) {
                return {
                    rows: results as Record<string, unknown>[],
                    executionTimeMs,
                    columns: fields?.map(f => ({
                        name: f.name,
                        type: this.getTypeName(f.type ?? 0)
                    }))
                };
            }

            const resultInfo = results as {
                affectedRows?: number;
                insertId?: number | bigint;
            };

            return {
                rowsAffected: resultInfo.affectedRows,
                lastInsertId: resultInfo.insertId,
                executionTimeMs
            };
        } catch (error) {
            const err = error as Error;
            throw new QueryError(`Query failed: ${err.message}`, { sql });
        }
    }

    /**
     * Execute raw SQL using query() instead of execute()
     * Use this for commands not supported in prepared statement protocol:
     * - CHECK TABLE, SAVEPOINT, RELEASE SAVEPOINT, ROLLBACK TO SAVEPOINT
     * - SHOW commands with LIKE patterns
     */
    async rawQuery(sql: string): Promise<QueryResult> {
        if (!this.pool) {
            throw new ConnectionError('Not connected');
        }

        const startTime = Date.now();

        try {
            // Use query() which doesn't use prepared statements
            // Unlike execute(), query() is required for certain MySQL commands
            const [results, fields] = await this.pool.query(sql);

            const executionTimeMs = Date.now() - startTime;

            if (Array.isArray(results)) {
                return {
                    rows: results as Record<string, unknown>[],
                    executionTimeMs,
                    columns: Array.isArray(fields) ? fields.map(f => ({
                        name: f.name,
                        type: this.getTypeName(f.type ?? 0)
                    })) : undefined
                };
            }

            const resultInfo = results as {
                affectedRows?: number;
                insertId?: number | bigint;
            };

            return {
                rowsAffected: resultInfo.affectedRows,
                lastInsertId: resultInfo.insertId,
                executionTimeMs
            };
        } catch (error) {
            const err = error as Error;
            throw new QueryError(`Raw query failed: ${err.message}`, { sql });
        }
    }

    // =========================================================================
    // Transaction Support
    // =========================================================================

    /**
     * Begin a transaction
     */
    async beginTransaction(isolationLevel?: string): Promise<string> {
        if (!this.pool) {
            throw new ConnectionError('Not connected');
        }

        const connection = await this.pool.getConnection();
        const transactionId = crypto.randomUUID();

        try {
            if (isolationLevel) {
                await connection.execute(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
            }
            await connection.beginTransaction();
            this.activeTransactions.set(transactionId, connection);
            return transactionId;
        } catch (error) {
            connection.release();
            throw new TransactionError(`Failed to begin transaction: ${String(error)}`);
        }
    }

    /**
     * Commit a transaction
     */
    async commitTransaction(transactionId: string): Promise<void> {
        const connection = this.activeTransactions.get(transactionId);
        if (!connection) {
            throw new TransactionError(`Transaction not found: ${transactionId}`);
        }

        try {
            await connection.commit();
        } finally {
            connection.release();
            this.activeTransactions.delete(transactionId);
        }
    }

    /**
     * Rollback a transaction
     */
    async rollbackTransaction(transactionId: string): Promise<void> {
        const connection = this.activeTransactions.get(transactionId);
        if (!connection) {
            throw new TransactionError(`Transaction not found: ${transactionId}`);
        }

        try {
            await connection.rollback();
        } finally {
            connection.release();
            this.activeTransactions.delete(transactionId);
        }
    }

    /**
     * Get connection for a transaction
     */
    getTransactionConnection(transactionId: string): PoolConnection | undefined {
        return this.activeTransactions.get(transactionId);
    }

    // =========================================================================
    // Schema Operations
    // =========================================================================

    async getSchema(): Promise<SchemaInfo> {
        const tables = await this.listTables();
        const views = tables.filter(t => t.type === 'view');
        const realTables = tables.filter(t => t.type === 'table');

        // Get all indexes
        const indexes: IndexInfo[] = [];
        for (const table of realTables) {
            const tableIndexes = await this.getTableIndexes(table.name);
            indexes.push(...tableIndexes);
        }

        return {
            tables: realTables,
            views,
            indexes
        };
    }

    async listTables(): Promise<TableInfo[]> {
        const result = await this.executeQuery(`
            SELECT 
                TABLE_NAME as name,
                TABLE_TYPE as type,
                ENGINE as engine,
                TABLE_ROWS as rowCount,
                DATA_LENGTH as dataLength,
                INDEX_LENGTH as indexLength,
                CREATE_TIME as createTime,
                UPDATE_TIME as updateTime,
                TABLE_COLLATION as collation,
                TABLE_COMMENT as comment
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME
        `);

        return (result.rows ?? []).map(row => ({
            name: row['name'] as string,
            type: (row['type'] as string) === 'VIEW' ? 'view' as const : 'table' as const,
            engine: row['engine'] as string | undefined,
            rowCount: row['rowCount'] as number | undefined,
            dataLength: row['dataLength'] as number | undefined,
            indexLength: row['indexLength'] as number | undefined,
            createTime: row['createTime'] as Date | undefined,
            updateTime: row['updateTime'] as Date | undefined,
            collation: row['collation'] as string | undefined,
            comment: row['comment'] as string | undefined
        }));
    }

    async describeTable(tableName: string): Promise<TableInfo> {
        // Validate table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
            throw new ValidationError('Invalid table name');
        }

        // Get column information
        const columnsResult = await this.executeQuery(`
            SELECT 
                COLUMN_NAME as name,
                DATA_TYPE as type,
                IS_NULLABLE as nullable,
                COLUMN_KEY as columnKey,
                COLUMN_DEFAULT as defaultValue,
                EXTRA as extra,
                CHARACTER_SET_NAME as characterSet,
                COLLATION_NAME as collation,
                COLUMN_COMMENT as comment
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `, [tableName]);

        const columns: ColumnInfo[] = (columnsResult.rows ?? []).map(row => ({
            name: row['name'] as string,
            type: row['type'] as string,
            nullable: row['nullable'] === 'YES',
            primaryKey: row['columnKey'] === 'PRI',
            defaultValue: row['defaultValue'],
            autoIncrement: (row['extra'] as string)?.includes('auto_increment'),
            characterSet: row['characterSet'] as string | undefined,
            collation: row['collation'] as string | undefined,
            comment: row['comment'] as string | undefined
        }));

        // Get table info
        const tableResult = await this.executeQuery(`
            SELECT 
                TABLE_TYPE as type,
                ENGINE as engine,
                TABLE_ROWS as rowCount,
                TABLE_COLLATION as collation,
                TABLE_COMMENT as comment
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
        `, [tableName]);

        const tableRow = tableResult.rows?.[0];

        return {
            name: tableName,
            type: tableRow?.['type'] === 'VIEW' ? 'view' : 'table',
            engine: tableRow?.['engine'] as string | undefined,
            rowCount: tableRow?.['rowCount'] as number | undefined,
            collation: tableRow?.['collation'] as string | undefined,
            comment: tableRow?.['comment'] as string | undefined,
            columns
        };
    }

    async listSchemas(): Promise<string[]> {
        const result = await this.executeQuery(`SHOW DATABASES`);
        return (result.rows ?? []).map(row => {
            const values = Object.values(row);
            return values[0] as string;
        });
    }

    /**
     * Get indexes for a table
     */
    async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
        const result = await this.executeQuery(`
            SELECT 
                INDEX_NAME as name,
                NON_UNIQUE as nonUnique,
                COLUMN_NAME as columnName,
                INDEX_TYPE as type,
                CARDINALITY as cardinality
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `, [tableName]);

        // Group columns by index name
        const indexMap = new Map<string, IndexInfo>();

        for (const row of result.rows ?? []) {
            const name = row['name'] as string;
            const existing = indexMap.get(name);

            if (existing) {
                existing.columns.push(row['columnName'] as string);
            } else {
                indexMap.set(name, {
                    name,
                    tableName,
                    columns: [row['columnName'] as string],
                    unique: row['nonUnique'] === 0,
                    type: row['type'] as 'BTREE' | 'HASH' | 'FULLTEXT' | 'SPATIAL',
                    cardinality: row['cardinality'] as number | undefined
                });
            }
        }

        return Array.from(indexMap.values());
    }

    // =========================================================================
    // Capabilities
    // =========================================================================

    getCapabilities(): AdapterCapabilities {
        return {
            json: true,
            fullTextSearch: true,
            vector: false, // MySQL doesn't have native vector support
            geospatial: true,
            transactions: true,
            preparedStatements: true,
            connectionPooling: true,
            partitioning: true,
            replication: true
        };
    }

    getSupportedToolGroups(): ToolGroup[] {
        return [
            'core',
            'json',
            'text',
            'fulltext',
            'performance',
            'optimization',
            'admin',
            'monitoring',
            'backup',
            'replication',
            'partitioning',
            'transactions',
            'router'
        ];
    }

    // =========================================================================
    // Tool/Resource/Prompt Registration
    // =========================================================================

    getToolDefinitions(): ToolDefinition[] {
        return [
            ...getCoreTools(this),
            ...getTransactionTools(this),
            ...getJsonTools(this),
            ...getJsonHelperTools(this),
            ...getTextTools(this),
            ...getFulltextTools(this),
            ...getPerformanceTools(this),
            ...getOptimizationTools(this),
            ...getAdminTools(this),
            ...getMonitoringTools(this),
            ...getBackupTools(this),
            ...getReplicationTools(this),
            ...getPartitioningTools(this),
            ...getRouterTools(this)
        ];
    }

    getResourceDefinitions(): ResourceDefinition[] {
        return getMySQLResources(this);
    }

    getPromptDefinitions(): PromptDefinition[] {
        return getMySQLPrompts(this);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Get the connection pool (for monitoring tools)
     */
    getPool(): ConnectionPool | null {
        return this.pool;
    }

    /**
     * Convert MySQL type number to name
     */
    private getTypeName(typeNum: number): string {
        // MySQL type constants
        const types: Record<number, string> = {
            0: 'DECIMAL',
            1: 'TINYINT',
            2: 'SMALLINT',
            3: 'INT',
            4: 'FLOAT',
            5: 'DOUBLE',
            6: 'NULL',
            7: 'TIMESTAMP',
            8: 'BIGINT',
            9: 'MEDIUMINT',
            10: 'DATE',
            11: 'TIME',
            12: 'DATETIME',
            13: 'YEAR',
            14: 'NEWDATE',
            15: 'VARCHAR',
            16: 'BIT',
            245: 'JSON',
            246: 'NEWDECIMAL',
            247: 'ENUM',
            248: 'SET',
            249: 'TINYBLOB',
            250: 'MEDIUMBLOB',
            251: 'LONGBLOB',
            252: 'BLOB',
            253: 'VARCHAR',
            254: 'CHAR',
            255: 'GEOMETRY'
        };
        return types[typeNum] ?? `UNKNOWN(${typeNum})`;
    }
}
