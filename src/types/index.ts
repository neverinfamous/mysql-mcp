/**
 * mysql-mcp - MySQL MCP Server
 * 
 * Core type definitions for the MCP server, database adapters,
 * OAuth 2.0 authentication, and tool filtering.
 */

// =============================================================================
// Database Types
// =============================================================================

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

/**
 * Query execution result
 */
export interface QueryResult {
    /** Rows returned (for SELECT queries) */
    rows?: Record<string, unknown>[];

    /** Number of rows affected (for INSERT/UPDATE/DELETE) */
    rowsAffected?: number;

    /** Last inserted ID (for INSERT with auto-increment) */
    lastInsertId?: number | bigint;

    /** Warning count */
    warningCount?: number;

    /** Query execution time in milliseconds */
    executionTimeMs?: number;

    /** Column metadata */
    columns?: ColumnInfo[];

    /** Field info from MySQL */
    fields?: FieldInfo[];
}

/**
 * Column metadata information
 */
export interface ColumnInfo {
    name: string;
    type: string;
    nullable?: boolean;
    primaryKey?: boolean;
    defaultValue?: unknown;
    autoIncrement?: boolean;
    unsigned?: boolean;
    zerofill?: boolean;
    characterSet?: string;
    collation?: string;
    comment?: string;
}

/**
 * MySQL field information from result set
 */
export interface FieldInfo {
    name: string;
    table: string;
    database: string;
    type: number;
    length: number;
    flags: number;
}

/**
 * Table information
 */
export interface TableInfo {
    name: string;
    schema?: string;
    type: 'table' | 'view' | 'materialized_view';
    engine?: string;
    rowCount?: number;
    dataLength?: number;
    indexLength?: number;
    createTime?: Date;
    updateTime?: Date;
    collation?: string;
    comment?: string;
    columns?: ColumnInfo[];
}

/**
 * Schema information for a database
 */
export interface SchemaInfo {
    tables: TableInfo[];
    views?: TableInfo[];
    indexes?: IndexInfo[];
    constraints?: ConstraintInfo[];
    routines?: RoutineInfo[];
    triggers?: TriggerInfo[];
}

/**
 * Index information
 */
export interface IndexInfo {
    name: string;
    tableName: string;
    columns: string[];
    unique: boolean;
    type: 'BTREE' | 'HASH' | 'FULLTEXT' | 'SPATIAL';
    cardinality?: number;
}

/**
 * Constraint information
 */
export interface ConstraintInfo {
    name: string;
    tableName: string;
    type: 'primary_key' | 'foreign_key' | 'unique' | 'check';
    columns: string[];
    referencedTable?: string;
    referencedColumns?: string[];
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Stored procedure/function information
 */
export interface RoutineInfo {
    name: string;
    type: 'PROCEDURE' | 'FUNCTION';
    database: string;
    definer: string;
    created: Date;
    modified: Date;
}

/**
 * Trigger information
 */
export interface TriggerInfo {
    name: string;
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE';
    timing: 'BEFORE' | 'AFTER';
    statement: string;
}

// =============================================================================
// MCP Server Types
// =============================================================================

/**
 * Transport type for MCP communication
 */
export type TransportType = 'stdio' | 'http' | 'sse';

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
    /** Server name */
    name: string;

    /** Server version */
    version: string;

    /** Transport configuration */
    transport: TransportType;

    /** HTTP port (for http/sse transports) */
    port?: number;

    /** Database configurations */
    databases: DatabaseConfig[];

    /** OAuth configuration */
    oauth?: OAuthConfig;

    /** Tool filtering configuration */
    toolFilter?: string;
}

// =============================================================================
// OAuth 2.0 Types
// =============================================================================

/**
 * OAuth 2.0 configuration
 */
export interface OAuthConfig {
    /** Enable OAuth authentication */
    enabled: boolean;

    /** Authorization server URL */
    authorizationServerUrl?: string;

    /** Token validation endpoint */
    tokenEndpoint?: string;

    /** JWKS URI for token verification */
    jwksUri?: string;

    /** Expected audience in tokens */
    audience?: string;

    /** Expected issuer in tokens */
    issuer?: string;

    /** Clock tolerance for token validation (seconds) */
    clockTolerance?: number;

    /** JWKS cache TTL (seconds) */
    jwksCacheTtl?: number;

    /** Paths that bypass authentication */
    publicPaths?: string[];
}

/**
 * OAuth scopes for access control
 */
export type OAuthScope =
    | 'read'           // Read-only access to all databases
    | 'write'          // Read and write access
    | 'admin'          // Full administrative access
    | `db:${string}`   // Access to specific database
    | `table:${string}:${string}`; // Access to specific table

/**
 * Validated OAuth token claims
 */
export interface TokenClaims {
    /** Subject (user ID) */
    sub: string;

    /** Granted scopes */
    scopes: OAuthScope[];

    /** Token expiration time */
    exp: number;

    /** Token issued at time */
    iat: number;

    /** Token issuer */
    iss?: string;

    /** Token audience */
    aud?: string | string[];

    /** Additional claims */
    [key: string]: unknown;
}

/**
 * Request context with authentication info
 */
export interface RequestContext {
    /** Validated token claims (if authenticated) */
    auth?: TokenClaims;

    /** Raw access token */
    accessToken?: string;

    /** Request timestamp */
    timestamp: Date;

    /** Request ID for tracing */
    requestId: string;
}

// =============================================================================
// Tool Filtering Types
// =============================================================================

/**
 * Tool group identifiers for MySQL
 */
export type ToolGroup =
    | 'core'           // Basic CRUD, schema operations
    | 'json'           // JSON operations (MySQL 5.7+)
    | 'text'           // Text processing (LIKE, REGEXP)
    | 'fulltext'       // FULLTEXT search
    | 'performance'    // EXPLAIN, query analysis
    | 'optimization'   // Index hints, recommendations
    | 'admin'          // OPTIMIZE, ANALYZE, FLUSH
    | 'monitoring'     // PROCESSLIST, status variables
    | 'backup'         // Export, import, mysqldump
    | 'replication'    // Master/slave, binlog
    | 'partitioning'   // Partition management
    | 'transactions'   // Transaction control
    | 'router'         // MySQL Router management
    | 'proxysql'       // ProxySQL management
    | 'shell';         // MySQL Shell utilities

/**
 * MySQL Router REST API configuration
 */
export interface RouterConfig {
    /** Router REST API base URL (e.g., https://localhost:8443) */
    url?: string;

    /** Router API username */
    username?: string;

    /** Router API password */
    password?: string;

    /** Skip TLS certificate verification (for self-signed certs) */
    insecure?: boolean;

    /** API version path (default: /api/20190715) */
    apiVersion?: string;
}

/**
 * MySQL Shell configuration
 */
export interface MySQLShellConfig {
    /** Path to mysqlsh binary (defaults to 'mysqlsh' from PATH) */
    binPath?: string;

    /** Timeout for shell commands in milliseconds (default: 300000 = 5 min) */
    timeout?: number;

    /** Working directory for dump/load operations */
    workDir?: string;
}

/**
 * Tool filter rule
 */
export interface ToolFilterRule {
    /** Rule type: include or exclude */
    type: 'include' | 'exclude';

    /** Target: group name or tool name */
    target: string;

    /** Whether target is a group (true) or individual tool (false) */
    isGroup: boolean;
}

/**
 * Parsed tool filter configuration
 */
export interface ToolFilterConfig {
    /** Original filter string */
    raw: string;

    /** Parsed rules in order */
    rules: ToolFilterRule[];

    /** Set of enabled tool names after applying rules */
    enabledTools: Set<string>;
}

// =============================================================================
// Adapter Types
// =============================================================================

/**
 * Capabilities supported by a database adapter
 */
export interface AdapterCapabilities {
    /** Supports JSON operations */
    json: boolean;

    /** Supports full-text search */
    fullTextSearch: boolean;

    /** Supports vector/embedding operations */
    vector: boolean;

    /** Supports geospatial operations */
    geospatial: boolean;

    /** Supports transactions */
    transactions: boolean;

    /** Supports prepared statements */
    preparedStatements: boolean;

    /** Supports connection pooling */
    connectionPooling: boolean;

    /** Supports partitioning */
    partitioning: boolean;

    /** Supports replication */
    replication: boolean;

    /** Additional capability flags */
    [key: string]: boolean;
}

/**
 * Tool definition for registration
 */
export interface ToolDefinition {
    /** Unique tool name */
    name: string;

    /** Human-readable description */
    description: string;

    /** Tool group for filtering */
    group: ToolGroup;

    /** Zod schema for input validation */
    inputSchema: unknown;

    /** Required OAuth scopes */
    requiredScopes?: OAuthScope[];

    /** Tool handler function */
    handler: (params: unknown, context: RequestContext) => Promise<unknown>;
}

/**
 * Resource definition for MCP
 */
export interface ResourceDefinition {
    /** Resource URI template */
    uri: string;

    /** Human-readable name */
    name: string;

    /** Description */
    description: string;

    /** MIME type */
    mimeType?: string;

    /** Resource handler */
    handler: (uri: string, context: RequestContext) => Promise<unknown>;
}

/**
 * Prompt definition for MCP
 */
export interface PromptDefinition {
    /** Prompt name */
    name: string;

    /** Description */
    description: string;

    /** Argument definitions */
    arguments?: {
        name: string;
        description: string;
        required?: boolean;
    }[];

    /** Prompt handler */
    handler: (args: Record<string, string>, context: RequestContext) => Promise<unknown>;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error class for mysql-mcp
 */
export class MySQLMcpError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'MySQLMcpError';
    }
}

/**
 * Database connection error
 */
export class ConnectionError extends MySQLMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'CONNECTION_ERROR', details);
        this.name = 'ConnectionError';
    }
}

/**
 * Connection pool error
 */
export class PoolError extends MySQLMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'POOL_ERROR', details);
        this.name = 'PoolError';
    }
}

/**
 * Query execution error
 */
export class QueryError extends MySQLMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'QUERY_ERROR', details);
        this.name = 'QueryError';
    }
}

/**
 * Authentication error
 */
export class AuthenticationError extends MySQLMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'AUTHENTICATION_ERROR', details);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization error (insufficient permissions)
 */
export class AuthorizationError extends MySQLMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'AUTHORIZATION_ERROR', details);
        this.name = 'AuthorizationError';
    }
}

/**
 * Validation error for input parameters
 */
export class ValidationError extends MySQLMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

/**
 * Transaction error
 */
export class TransactionError extends MySQLMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'TRANSACTION_ERROR', details);
        this.name = 'TransactionError';
    }
}
