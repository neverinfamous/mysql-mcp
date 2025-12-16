/**
 * Database and Connection Types
 * 
 * Type definitions for database configuration, connection pooling,
 * and health monitoring.
 */

/**
 * Database type identifier (MySQL only for this server)
 */
export type DatabaseType = 'mysql';

/**
 * MySQL connection configuration
 */
export interface DatabaseConfig {
    /** Database type identifier */
    type: DatabaseType;

    /** Connection string (mysql://user:pass@host:port/database) */
    connectionString?: string;

    /** Individual connection parameters (alternative to connectionString) */
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;

    /** Connection pool options */
    pool?: PoolConfig;

    /** Additional MySQL-specific options */
    options?: MySQLOptions;
}

/**
 * MySQL-specific connection options
 */
export interface MySQLOptions {
    /** SSL configuration */
    ssl?: boolean | {
        ca?: string;
        cert?: string;
        key?: string;
        rejectUnauthorized?: boolean;
    };

    /** Character set (default: utf8mb4) */
    charset?: string;

    /** Timezone (default: local) */
    timezone?: string;

    /** Enable multiple statements (default: false for security) */
    multipleStatements?: boolean;

    /** Connection timeout in ms */
    connectTimeout?: number;

    /** Support big numbers as strings */
    supportBigNumbers?: boolean;

    /** Convert big numbers to strings */
    bigNumberStrings?: boolean;

    /** Date strings instead of Date objects */
    dateStrings?: boolean;
}

/**
 * Connection pool configuration
 */
export interface PoolConfig {
    /** Maximum number of connections in pool (default: 10) */
    connectionLimit?: number;

    /** Wait for connections if none available (default: true) */
    waitForConnections?: boolean;

    /** Maximum waiting requests (0 = unlimited, default: 0) */
    queueLimit?: number;

    /** Connection acquire timeout in ms (default: 10000) */
    acquireTimeout?: number;

    /** Enable TCP keep-alive (default: true) */
    enableKeepAlive?: boolean;

    /** Keep-alive initial delay in ms (default: 0) */
    keepAliveInitialDelay?: number;

    /** Idle timeout before closing connection in ms */
    idleTimeout?: number;
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
    /** Total connections in pool */
    total: number;

    /** Active connections (in use) */
    active: number;

    /** Idle connections (available) */
    idle: number;

    /** Waiting requests in queue */
    waiting: number;

    /** Total queries executed */
    totalQueries: number;
}

/**
 * Database connection health status
 */
export interface HealthStatus {
    connected: boolean;
    latencyMs?: number | undefined;
    version?: string | undefined;
    poolStats?: PoolStats | undefined;
    details?: Record<string, unknown> | undefined;
    error?: string | undefined;
}
