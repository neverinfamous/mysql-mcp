/**
 * mysql-mcp - Connection Pool Manager
 * 
 * Wraps mysql2 connection pooling with health monitoring,
 * statistics tracking, and graceful shutdown support.
 */

import mysql from 'mysql2/promise';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { PoolConfig, PoolStats, HealthStatus } from '../types/index.js';
import { PoolError, ConnectionError } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Connection pool configuration with defaults
 */
export interface ConnectionPoolConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    pool?: PoolConfig;
    ssl?: boolean | mysql.SslOptions;
    charset?: string;
    timezone?: string;
    connectTimeout?: number;
}

/**
 * Connection pool wrapper with statistics and health monitoring
 */
export class ConnectionPool {
    private pool: Pool | null = null;
    private config: ConnectionPoolConfig;
    private stats: PoolStats = {
        total: 0,
        active: 0,
        idle: 0,
        waiting: 0,
        totalQueries: 0
    };
    private isShuttingDown = false;

    constructor(config: ConnectionPoolConfig) {
        this.config = config;
    }

    /**
     * Initialize the connection pool
     */
    async initialize(): Promise<void> {
        if (this.pool) {
            logger.warn('Connection pool already initialized');
            return;
        }

        const poolConfig = this.config.pool ?? {};

        try {
            this.pool = mysql.createPool({
                host: this.config.host,
                port: this.config.port,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,

                // Pool options with defaults
                connectionLimit: poolConfig.connectionLimit ?? 10,
                waitForConnections: poolConfig.waitForConnections ?? true,
                queueLimit: poolConfig.queueLimit ?? 0,

                // Connection options
                connectTimeout: this.config.connectTimeout ?? 10000,
                charset: this.config.charset ?? 'utf8mb4',
                timezone: this.config.timezone ?? 'local',

                // SSL - convert boolean to mysql2 compatible format
                // mysql2 expects string | SslOptions | undefined, not boolean
                ssl: typeof this.config.ssl === 'boolean'
                    ? (this.config.ssl ? {} : undefined)
                    : this.config.ssl,

                // Other options
                enableKeepAlive: poolConfig.enableKeepAlive ?? true,
                keepAliveInitialDelay: poolConfig.keepAliveInitialDelay ?? 0,

                // Namedplaceholders for better parameter handling
                namedPlaceholders: false,

                // Promise wrapper
                Promise: Promise
            });

            // Test the connection
            const connection = await this.pool.getConnection();
            connection.release();

            logger.info('Connection pool initialized', {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                connectionLimit: poolConfig.connectionLimit ?? 10
            });
        } catch (error) {
            const err = error as Error;
            throw new ConnectionError(`Failed to initialize connection pool: ${err.message}`, {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database
            });
        }
    }

    /**
     * Get a connection from the pool
     */
    async getConnection(): Promise<PoolConnection> {
        if (!this.pool) {
            throw new PoolError('Connection pool not initialized');
        }

        if (this.isShuttingDown) {
            throw new PoolError('Connection pool is shutting down');
        }

        try {
            const connection = await this.pool.getConnection();
            this.stats.active++;
            return connection;
        } catch (error) {
            const err = error as Error;
            throw new PoolError(`Failed to get connection: ${err.message}`);
        }
    }

    /**
     * Release a connection back to the pool
     */
    releaseConnection(connection: PoolConnection): void {
        try {
            connection.release();
            this.stats.active = Math.max(0, this.stats.active - 1);
        } catch (error) {
            logger.error('Error releasing connection', { error: String(error) });
        }
    }

    /**
     * Execute a query using a pooled connection
     * Returns full result tuple [rows, fields] for compatibility with rawQuery
     */
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<[T, mysql.FieldPacket[]]> {
        if (!this.pool) {
            throw new PoolError('Connection pool not initialized');
        }

        this.stats.totalQueries++;

        try {
            const result = await this.pool.query(sql, params);
            return result as [T, mysql.FieldPacket[]];
        } catch (error) {
            const err = error as Error;
            throw new PoolError(`Query failed: ${err.message}`, { sql });
        }
    }

    /**
     * Execute a query and return full result with metadata
     */
    async execute<T = unknown>(sql: string, params?: unknown[]): Promise<[T, mysql.FieldPacket[]]> {
        if (!this.pool) {
            throw new PoolError('Connection pool not initialized');
        }

        this.stats.totalQueries++;

        try {
            const result = await this.pool.execute(sql, params);
            return result as [T, mysql.FieldPacket[]];
        } catch (error) {
            const err = error as Error;
            throw new PoolError(`Execute failed: ${err.message}`, { sql });
        }
    }

    /**
     * Get pool statistics
     */
    getStats(): PoolStats {
        if (!this.pool) {
            return this.stats;
        }

        // mysql2 pool doesn't expose detailed stats directly
        // We track what we can
        return {
            ...this.stats,
            total: this.config.pool?.connectionLimit ?? 10,
            idle: (this.config.pool?.connectionLimit ?? 10) - this.stats.active
        };
    }

    /**
     * Check pool health
     */
    async checkHealth(): Promise<HealthStatus> {
        if (!this.pool) {
            return {
                connected: false,
                error: 'Pool not initialized'
            };
        }

        const startTime = Date.now();

        try {
            const connection = await this.pool.getConnection();
            try {
                // Ping to verify connection
                await connection.ping();

                // Get server version
                const [rows] = await connection.query('SELECT VERSION() as version');
                const result = rows as { version: string }[];
                const version = result[0]?.version;

                const latencyMs = Date.now() - startTime;

                return {
                    connected: true,
                    latencyMs,
                    version,
                    poolStats: this.getStats()
                };
            } finally {
                connection.release();
            }
        } catch (error) {
            return {
                connected: false,
                latencyMs: Date.now() - startTime,
                error: String(error),
                poolStats: this.getStats()
            };
        }
    }

    /**
     * Gracefully shutdown the pool
     */
    async shutdown(): Promise<void> {
        if (!this.pool) {
            return;
        }

        this.isShuttingDown = true;
        logger.info('Shutting down connection pool...');

        try {
            await this.pool.end();
            this.pool = null;
            logger.info('Connection pool shut down successfully');
        } catch (error) {
            logger.error('Error shutting down connection pool', { error: String(error) });
            throw error;
        }
    }

    /**
     * Check if pool is initialized
     */
    isInitialized(): boolean {
        return this.pool !== null;
    }

    /**
     * Check if pool is shutting down
     */
    isClosing(): boolean {
        return this.isShuttingDown;
    }
}
