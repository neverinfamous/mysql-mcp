/**
 * mysql-mcp - MySQL MCP Server
 * 
 * Core type definitions for the MCP server, database adapters,
 * OAuth 2.0 authentication, and tool filtering.
 * 
 * This is a barrel export that re-exports all types from the modules directory.
 */

// Database and connection types
export type { DatabaseType, DatabaseConfig, MySQLOptions, PoolConfig, PoolStats, HealthStatus } from './modules/database.js';

// Query and schema types
export type {
    QueryResult,
    ColumnInfo,
    FieldInfo,
    TableInfo,
    SchemaInfo,
    IndexInfo,
    ConstraintInfo,
    RoutineInfo,
    TriggerInfo
} from './modules/query.js';

// Server configuration types
export type { TransportType, McpServerConfig } from './modules/server.js';

// OAuth and authentication types
export type { OAuthConfig, OAuthScope, TokenClaims, RequestContext } from './modules/oauth.js';

// Tool, resource, and filtering types
export type {
    ToolGroup,
    MetaGroup,
    RouterConfig,
    MySQLShellConfig,
    ToolFilterRule,
    ToolFilterConfig,
    AdapterCapabilities,
    ToolAnnotations,
    ToolDefinition,
    ResourceAnnotations,
    ResourceDefinition,
    PromptDefinition
} from './modules/tools.js';

// Error classes
export {
    MySQLMcpError,
    ConnectionError,
    PoolError,
    QueryError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    TransactionError
} from './modules/errors.js';
